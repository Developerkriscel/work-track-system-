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

function convertToIsoTime(dmyDate, ampmTime) {
   // dmyDate: "01/08/2026", ampmTime: "09:50:00 am"
   const dParts = dmyDate.split('/');
   const day = dParts[0];
   const month = dParts[1];
   const year = dParts[2];
   
   let h = 0, m = 0, s = 0;
   const timeMatch = ampmTime.match(/(\d+):(\d+):(\d+)\s*(am|pm)/i);
   if (timeMatch) {
       h = parseInt(timeMatch[1], 10);
       m = parseInt(timeMatch[2], 10);
       s = parseInt(timeMatch[3], 10);
       const ampm = timeMatch[4].toLowerCase();
       if (ampm === 'pm' && h < 12) h += 12;
       if (ampm === 'am' && h === 12) h = 0;
   }
   
   const isoString = `${year}-${month}-${day}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}+05:30`;
   return new Date(isoString).toISOString();
}

async function run() {
  await connectDatabase();
  console.log('Connected to MongoDB');

  const AttendanceModel = mongoose.models.attendance_legacy || mongoose.model('attendance_legacy', legacyRowSchema, 'attendance_legacy');

  // Find all records I inserted recently. They have "01/08/2026" style dates in data.Date.
  // Wait, some might have other dates in August, let's just find anything with legacyId starting with ATT_ and ending with _178...
  // Or we can find by Date format DD/MM/YYYY since valid ones are YYYY-MM-DD
  const myRecords = await AttendanceModel.find({
      'data.Date': { $regex: /^\d{2}\/\d{2}\/\d{4}$/ }
  });

  console.log(`Found ${myRecords.length} records to fix`);

  let count = 0;
  for (const doc of myRecords) {
      const dmy = doc.data.Date; // e.g. "01/08/2026"
      const dParts = dmy.split('/');
      const isoDate = `${dParts[2]}-${dParts[1]}-${dParts[0]}`; // YYYY-MM-DD
      
      const ampmTime = doc.data.Time || doc.data['Punch In'] || doc.data['Punch Out'] || '';
      let isoTime = ampmTime;
      try {
          if (ampmTime && ampmTime.includes('m')) {
              isoTime = convertToIsoTime(dmy, ampmTime);
          }
      } catch(e) {}

      const newData = { ...doc.data };
      newData.Date = isoDate;
      newData.Time = isoTime;
      newData.EmpID = newData['Employee ID'];
      newData.Name = newData['Employee Name'];
      newData.AttendanceID = doc.legacyId;
      
      if (!newData.Photo) newData.Photo = newData['Photo URL'];

      await AttendanceModel.updateOne(
          { _id: doc._id },
          { $set: { data: newData } }
      );
      count++;
  }

  console.log(`Updated ${count} records with YYYY-MM-DD and exact fields!`);
  
  // Clear redis cache
  try {
     const { deleteByPrefix } = await import('./services/redisCache.service.js');
     await deleteByPrefix('attendance');
     console.log('Cleared redis cache for attendance');
  } catch (e) {
     console.error("Cache clear error:", e);
  }

  mongoose.connection.close();
}

run().catch(console.error);
