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

function calcDurationStr(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const parseTime = (timeStr) => {
    const m = String(timeStr).match(/(\d+):(\d+):(\d+)/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const startMins = parseTime(startStr);
  const endMins = parseTime(endStr);
  if (startMins === null || endMins === null) return null;
  
  let diff = endMins - startMins;
  if (diff < 0) diff += 24 * 60; // crossed midnight
  
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h ${m}m`;
}

function isTargetDate(dateStr) {
  if (!dateStr) return false;
  const str = String(dateStr);
  const targetDates = [
    '27-08-2026', '28-08-2026', '29-08-2026', '30-08-2026', '31-08-2026',
    '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31'
  ];
  return targetDates.some(td => str.includes(td));
}

async function run() {
  await connectDatabase();
  console.log('Connected to MongoDB');

  const TicketModel = mongoose.models.tickets_legacy || mongoose.model('tickets_legacy', legacyRowSchema, 'tickets_legacy');

  const ticketsToUpdate = await TicketModel.find({});
  let updatedCount = 0;

  for (let doc of ticketsToUpdate) {
    const data = doc.data || {};
    
    // Find date
    const planDate = data['Plan Date'] || data['Date'] || data['Timestamp'] || data['planDate'];
    
    if (isTargetDate(planDate)) {
      const startTime = data['Start Time'];
      const endTime = data['End Time'];
      
      if (startTime && endTime) {
        const correctDuration = calcDurationStr(startTime, endTime);
        if (correctDuration) {
          const currentDuration = data['Total Duration'] || data['Duration'];
          
          if (currentDuration !== correctDuration) {
            console.log(`Ticket ${data['Ticket ID'] || doc._id}: Date ${planDate}, ${startTime} to ${endTime}. Old: ${currentDuration} -> New: ${correctDuration}`);
            
            let newData = { ...data };
            if (newData['Total Duration'] !== undefined) newData['Total Duration'] = correctDuration;
            if (newData['Duration'] !== undefined) newData['Duration'] = correctDuration;
            if (newData['totalDuration'] !== undefined) newData['totalDuration'] = correctDuration;
            if (newData['duration'] !== undefined) newData['duration'] = correctDuration;
            
            await TicketModel.updateOne({ _id: doc._id }, { $set: { data: newData } });
            updatedCount++;
          }
        }
      }
    }
  }

  console.log(`Updated ${updatedCount} tickets.`);

  mongoose.connection.close();
}

run().catch(console.error);
