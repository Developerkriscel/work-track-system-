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

  const TicketModel = mongoose.models.tickets_legacy || mongoose.model('tickets_legacy', legacyRowSchema, 'tickets_legacy');

  const activeTickets = await TicketModel.find({});
  let count = 0;
  
  for (let doc of activeTickets) {
    const data = doc.data;
    const ticketId = data['Ticket ID'] || doc._id;
    
    const planDate = data['Plan Date'] || data['Date'] || data['Timestamp'];
    const durationStr = data['Total Duration'] || data['Duration'] || '0h 0m';
    
    const hours = durationStr.match(/(\d+(?:\.\d+)?)\s*h/i);
    const minutes = durationStr.match(/(\d+(?:\.\d+)?)\s*m/i);
    let totalMins = 0;
    if (hours || minutes) {
      totalMins = Math.round(Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0));
    }
    
    // Reset inherited/buggy crazy durations for today's tickets
    if (String(planDate).includes('31-08-2026') || String(planDate).includes('2026-08-31') || String(planDate).includes('8/31/2026')) {
      if (totalMins > 600) { // More than 10 hours for today's ticket is impossible
         console.log(`Fixing duration for ${ticketId} (was ${durationStr})`);
         
         let newData = { ...data };
         if (newData['Total Duration'] !== undefined) newData['Total Duration'] = '';
         if (newData['Duration'] !== undefined) newData['Duration'] = '';
         if (newData['totalDuration'] !== undefined) newData['totalDuration'] = '';
         
         // Also reset the auto ticket templates in the DB so they don't spawn bad tickets tomorrow
         if (data['Auto Ticket'] === 'Yes' || data['Is Auto Ticket'] === 'Yes') {
             console.log(`Also fixed master template: ${ticketId}`);
         }
         
         await TicketModel.updateOne({ _id: doc._id }, { $set: { data: newData } });
         count++;
      }
    } else if (data['Auto Ticket'] === 'Yes' || data['Is Auto Ticket'] === 'Yes') {
      // Fix all auto ticket templates regardless of date so they never spawn with duration
      if (totalMins > 0) {
         let newData = { ...data };
         if (newData['Total Duration'] !== undefined) newData['Total Duration'] = '';
         if (newData['Duration'] !== undefined) newData['Duration'] = '';
         if (newData['totalDuration'] !== undefined) newData['totalDuration'] = '';
         await TicketModel.updateOne({ _id: doc._id }, { $set: { data: newData } });
         console.log(`Fixed auto template duration for ${ticketId}`);
         count++;
      }
    }
  }

  console.log(`Updated ${count} tickets.`);
  mongoose.connection.close();
}

run().catch(console.error);
