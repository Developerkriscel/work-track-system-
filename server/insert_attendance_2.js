import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database.js';
import { deleteByPrefix } from './services/redisCache.service.js';

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

function formatTimeTo12Hour(timeString) {
  // input: "15:35:00" output "03:35:00 pm"
  const parts = timeString.split(':');
  if (parts.length < 2) return timeString;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const s = parts[2] || '00';
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h.toString().padStart(2, '0')}:${m}:${s} ${ampm}`;
}

function convertToIsoTime(year, month, day, h24, m, s) {
   const isoString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${h24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}+05:30`;
   return new Date(isoString).toISOString();
}

async function run() {
  await connectDatabase();
  console.log('Connected to MongoDB');
  const AttendanceModel = mongoose.models.attendance_legacy || mongoose.model('attendance_legacy', legacyRowSchema, 'attendance_legacy');

  const text = fs.readFileSync(path.join(__dirname, 'raw_attendance_2.txt'), 'utf8');
  const blocks = text.split(/\n(?=\d{1,2}\/\d{1,2}\/\d{4})/);
  
  const toInsert = [];
  const datesAndEmployeesToClear = new Set();
  
  console.log(`Found ${blocks.length} blocks to parse.`);

  blocks.forEach((block, index) => {
    if (!block.trim()) return;
    const lines = block.trim().split('\n');
    
    // Example lines:
    // 8/1/2026 15:35:00 (timestamp)
    // 8/1/2026 15:35:00 (date/time separate later, but here they are just 2 timestamps)
    // S103
    // Sunny
    // Punch In
    // 28.54687423
    // 77.04812722
    // Present
    // Approved
    // OR it could have Photo URL before Latitude
    
    try {
        let timestamp = lines[0].trim(); // e.g. "8/1/2026 15:35:00"
        
        let datePart = timestamp.split(' ')[0];
        let timePart = timestamp.split(' ')[1]; // "15:35:00"
        
        const dp = datePart.split('/'); // M/D/YYYY
        let month = dp[0];
        let day = dp[1];
        let year = dp[2];
        
        let isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        const tp = timePart.split(':');
        const isoTime = convertToIsoTime(year, month, day, tp[0], tp[1], tp[2] || '00');
        const formatted12Hr = formatTimeTo12Hour(timePart);

        // find Employee ID (Starts with S, MS, AS)
        let empIdIndex = lines.findIndex(l => /^[A-Z]+\d+$/.test(l.trim()));
        if (empIdIndex === -1) {
             console.log("Could not find EmpID for block", lines[0]);
             return;
        }
        
        const empId = lines[empIdIndex].trim();
        const empName = lines[empIdIndex + 1].trim();
        const action = lines[empIdIndex + 2].trim();
        
        let photoUrl = "";
        let latIndex = empIdIndex + 3;
        if (lines[latIndex].includes('http')) {
             photoUrl = lines[latIndex].trim();
             latIndex++;
        }
        
        let lat = parseFloat(lines[latIndex].trim());
        let lng = parseFloat(lines[latIndex + 1].trim());
        
        let durIndex = latIndex + 2;
        let duration = "";
        if (lines[durIndex] && /h|m/.test(lines[durIndex]) && !['Present', 'Absent', 'Half Day'].includes(lines[durIndex])) {
             duration = lines[durIndex].trim();
             durIndex++;
        }
        
        let status = lines[durIndex] ? lines[durIndex].trim() : "Present";
        let adminApproval = lines[durIndex + 1] ? lines[durIndex + 1].trim() : "Approved";
        
        let legacyId = `ATT_${empId}_${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${year}_${index}_${Date.now()}`;
        
        const data = {
            "Timestamp": `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year} ${formatted12Hr}`,
            "Date": isoDate,
            "Time": isoTime,
            "Employee ID": empId,
            "EmpID": empId,
            "Employee Name": empName,
            "Name": empName,
            "AttendanceID": legacyId,
            "Action": action,
            "Photo": photoUrl,
            "Photo URL": photoUrl,
            "Photo Url": photoUrl,
            "Latitude": lat,
            "Lattitude": lat,
            "Longitude": lng,
            "Status": status,
            "Admin Approval": adminApproval,
            "Duration": duration
        };
        
        if (action === "Punch In") {
            data["Punch In"] = formatted12Hr;
        } else if (action === "Punch Out") {
            data["Punch Out"] = formatted12Hr;
        }

        toInsert.push({ legacyId, data });
        datesAndEmployeesToClear.add(`${empId}|${isoDate}`);
    } catch(e) {
        console.log("Error parsing block:", lines[0], e.message);
    }
  });

  console.log(`Parsed ${toInsert.length} valid records to insert.`);
  
  let deletedCount = 0;
  for (const combo of datesAndEmployeesToClear) {
      const [empId, isoDate] = combo.split('|');
      const res = await AttendanceModel.deleteMany({
          'data.EmpID': empId,
          'data.Date': isoDate
      });
      deletedCount += res.deletedCount;
  }
  console.log(`Cleaned up ${deletedCount} existing records for these dates and employees to avoid duplicates.`);
  
  if (toInsert.length > 0) {
      await AttendanceModel.insertMany(toInsert);
      console.log(`Successfully inserted ${toInsert.length} new records!`);
  }
  
  try {
     await deleteByPrefix('attendance');
     console.log('Cleared redis cache for attendance');
  } catch (e) {
     console.error("Cache clear error:", e);
  }

  process.exit(0);
}

run().catch(console.error);
