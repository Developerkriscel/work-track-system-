import fs from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const legacyRowSchema = new mongoose.Schema(
  {
    legacyId: { type: String, index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, strict: false }
);

function formatAmPm(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const s = parts[2] || '00';
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  const hStr = h.toString().padStart(2, '0');
  return `${hStr}:${m}:${s} ${ampm}`;
}

async function run() {
  await connectDatabase();
  console.log('Connected to MongoDB');

  const AttendanceModel = mongoose.models.attendance_legacy || mongoose.model('attendance_legacy', legacyRowSchema, 'attendance_legacy');

  const raw = fs.readFileSync('raw_attendance.txt', 'utf8');
  const lines = raw.split('\n').map(l => l.trim());

  let attendances = [];
  let i = 0;
  
  // We need to track the exact dates we are touching in both M/D/YYYY and DD/MM/YYYY formats
  // so we can delete the incorrectly inserted ones and any old ones.
  let employeeDateCombinationsToDelete = new Set();

  while (i < lines.length) {
    if (!lines[i]) {
      i++;
      continue;
    }

    if (/^\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}:\d{2}$/.test(lines[i]) && lines[i+2] && /^[a-zA-Z]+[0-9]+$/.test(lines[i+2])) {
      const timestamp1 = lines[i++];
      const timestamp2 = lines[i++];
      const employeeId = lines[i++];
      const employeeName = lines[i++];
      const action = lines[i++];
      const photoUrl = lines[i++];
      const latitude = lines[i++];
      const longitude = lines[i++];
      
      let duration = null;
      if (action.includes('Punch Out') && i < lines.length && /^\d+h \d+m/.test(lines[i])) {
         duration = lines[i++];
      }

      const status = lines[i++];
      const approvalStatus = lines[i++];
      
      const dateParts = timestamp1.split(' ');
      const rawDateVal = dateParts[0]; // e.g. "8/1/2026" (M/D/YYYY)
      const rawTimeVal = dateParts[1]; // e.g. "9:50:00"

      // Convert M/D/YYYY to DD/MM/YYYY
      const dParts = rawDateVal.split('/');
      const month = dParts[0].padStart(2, '0');
      const day = dParts[1].padStart(2, '0');
      const year = dParts[2];
      const correctDateVal = `${day}/${month}/${year}`; // DD/MM/YYYY
      const correctTimeVal = formatAmPm(rawTimeVal);
      const correctTimestamp = `${correctDateVal} ${correctTimeVal}`;

      let att = {
         'Timestamp': correctTimestamp,
         'Date': correctDateVal,
         'Time': correctTimeVal,
         'Employee ID': employeeId,
         'Employee Name': employeeName,
         'Action': action,
         'Photo URL': photoUrl,
         'Photo Url': photoUrl,
         'Latitude': parseFloat(latitude) || latitude,
         'Lattitude': parseFloat(latitude) || latitude,
         'Longitude': parseFloat(longitude) || longitude,
         'Status': status,
         'Admin Approval': approvalStatus
      };

      if (duration) {
         att['Total Duration'] = duration;
         att['Duration'] = duration;
      }
      
      if (action.includes('Punch In')) {
         att['Punch In'] = correctTimeVal;
      } else {
         att['Punch Out'] = correctTimeVal;
      }

      attendances.push(att);
      employeeDateCombinationsToDelete.add(`${employeeId}|${rawDateVal}`);
      employeeDateCombinationsToDelete.add(`${employeeId}|${correctDateVal}`);
    } else {
      i++;
    }
  }

  console.log(`Parsed ${attendances.length} attendance records with correct format.`);
  
  console.log('Finding records to delete (cleaning up both previous incorrect inserts and any existing matching dates)...');
  const allExisting = await AttendanceModel.find({});
  let toDeleteIds = [];
  
  for (let doc of allExisting) {
    let docDate = doc.data?.Date || doc.data?.date;
    let docEmpId = doc.data?.['Employee ID'] || doc.data?.employeeId;
    
    if (typeof docDate === 'string' && docEmpId) {
      let d = docDate.split(' ')[0];
      // Try to match against either M/D/YYYY or DD/MM/YYYY
      let key = `${docEmpId}|${d}`;
      
      // Also maybe it was converted to YYYY-MM-DD
      let ymdKey = '';
      let dParts = d.split('-');
      if (dParts.length === 3) {
        // convert 2026-08-01 to 8/1/2026 or 01/08/2026 to see if it matches
        let m = parseInt(dParts[1], 10);
        let dy = parseInt(dParts[2], 10);
        let yr = dParts[0];
        if (employeeDateCombinationsToDelete.has(`${docEmpId}|${m}/${dy}/${yr}`)) {
           toDeleteIds.push(doc._id);
           continue;
        }
      }

      if (employeeDateCombinationsToDelete.has(key)) {
        toDeleteIds.push(doc._id);
      }
    }
  }

  console.log(`Found ${toDeleteIds.length} existing attendance records to delete.`);
  if (toDeleteIds.length > 0) {
    await AttendanceModel.deleteMany({ _id: { $in: toDeleteIds } });
    console.log(`Deleted ${toDeleteIds.length} records.`);
  }

  console.log('Inserting correctly formatted attendance records...');
  const docsToInsert = attendances.map((t, idx) => ({
    legacyId: `ATT_${t['Employee ID']}_${t.Date.replace(/\//g, '-')}_${idx}_${Date.now()}`,
    data: t
  }));

  if (docsToInsert.length > 0) {
    await AttendanceModel.insertMany(docsToInsert);
    console.log(`Inserted ${docsToInsert.length} new attendance records.`);
  }

  mongoose.connection.close();
}

run().catch(console.error);
