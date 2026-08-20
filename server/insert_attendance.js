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

async function run() {
  await connectDatabase();
  console.log('Connected to MongoDB');

  const AttendanceModel = mongoose.models.attendance_legacy || mongoose.model('attendance_legacy', legacyRowSchema, 'attendance_legacy');

  const raw = fs.readFileSync('raw_attendance.txt', 'utf8');
  const lines = raw.split('\n').map(l => l.trim());

  let attendances = [];
  let i = 0;

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
      const dateVal = dateParts[0];
      const timeVal = dateParts[1];

      let att = {
         'Timestamp': timestamp1,
         'Date': dateVal,
         'Time': timeVal,
         'Employee ID': employeeId,
         'Employee Name': employeeName,
         'Action': action,
         'Photo URL': photoUrl,
         'Latitude': latitude,
         'Longitude': longitude,
         'Status': status,
         'Approval Status': approvalStatus
      };

      if (duration) {
         att['Total Duration'] = duration;
         att['Duration'] = duration;
      }
      
      if (action.includes('Punch In')) {
         att['Punch In'] = timeVal;
      } else {
         att['Punch Out'] = timeVal;
      }

      attendances.push(att);
    } else {
      i++;
    }
  }

  console.log(`Parsed ${attendances.length} attendance records`);

  const datesToDelete = [
    '8/10/2026', '8/11/2026', '8/12/2026', '8/13/2026', '8/14/2026',
    '8/15/2026', '8/16/2026', '8/17/2026', '8/18/2026', '8/19/2026',
    '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14',
    '2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19'
  ];

  console.log('Finding records to delete...');
  const allExisting = await AttendanceModel.find({});
  let toDeleteIds = [];
  
  for (let doc of allExisting) {
    let docDate = doc.data?.Date || doc.data?.date;
    if (typeof docDate === 'string') {
      let d = docDate.split(' ')[0];
      if (datesToDelete.includes(d)) {
        toDeleteIds.push(doc._id);
      }
    }
  }

  console.log(`Found ${toDeleteIds.length} existing attendance records to delete in this date range.`);
  if (toDeleteIds.length > 0) {
    await AttendanceModel.deleteMany({ _id: { $in: toDeleteIds } });
    console.log(`Deleted ${toDeleteIds.length} records.`);
  }

  console.log('Inserting new attendance records...');
  const docsToInsert = attendances.map((t, idx) => ({
    legacyId: `ATT_${t['Employee ID']}_${t.Date.replace(/\//g, '')}_${idx}`,
    data: t
  }));

  if (docsToInsert.length > 0) {
    await AttendanceModel.insertMany(docsToInsert);
    console.log(`Inserted ${docsToInsert.length} attendance records.`);
  }

  mongoose.connection.close();
}

run().catch(console.error);
