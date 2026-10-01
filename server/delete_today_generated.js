import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const legacyRowSchema = new mongoose.Schema(
  { legacyId: { type: String, index: true }, data: { type: mongoose.Schema.Types.Mixed, default: {} } },
  { timestamps: true, strict: false }
);

async function run() {
  await connectDatabase();
  const Ticket = mongoose.model('Ticket', legacyRowSchema, 'tickets_legacy');

  const todayStr1 = '31-08-2026';
  const todayStr2 = '2026-08-31';
  const todayStr3 = '8/31/2026';

  const allTickets = await Ticket.find({});
  const todayTickets = allTickets.filter(doc => {
    const data = doc.data || {};
    const pd = String(data['Plan Date'] || data['Date'] || data['Timestamp'] || '');
    return pd.includes(todayStr1) || pd.includes(todayStr2) || pd.includes(todayStr3);
  });

  console.log(`Found total ${todayTickets.length} tickets for Aug 31, 2026.`);

  // Group tickets by unique combination
  const groups = {};
  for (const doc of todayTickets) {
    const data = doc.data;
    // Exclude master templates if any somehow matched
    if (data['Auto Ticket'] === 'Yes' || data['Is Auto Ticket'] === 'Yes') continue;

    const clientId = String(data['Client_Id'] || data['Client ID'] || '').trim().toLowerCase();
    const empId = String(data['Employee ID'] || data['EmpID'] || '').trim().toLowerCase();
    const desc = String(data['Task Description'] || data['Description'] || '').trim().toLowerCase();
    
    // Create a fingerprint
    const key = `${clientId}|${empId}|${desc}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(doc);
  }

  let deletedCount = 0;

  for (const key in groups) {
    const group = groups[key];
    if (group.length > 1) {
      // We have duplicates!
      console.log(`\nFound group with ${group.length} duplicates for signature: ${key.substring(0, 60)}...`);
      
      // Sort them to prioritize keeping the ones with action
      group.sort((a, b) => {
        const statusA = String(a.data.Status || '').toLowerCase();
        const statusB = String(b.data.Status || '').toLowerCase();
        // If one is untouched ('pending' or 'open' or 'new'), give it lower priority
        const weightA = ['pending', 'open', 'new'].includes(statusA) ? 0 : 1;
        const weightB = ['pending', 'open', 'new'].includes(statusB) ? 0 : 1;
        return weightB - weightA; // Higher weight (acted upon) comes first
      });

      // Keep the first one
      const toKeep = group[0];
      const toDelete = group.slice(1);

      console.log(`  Keeping ticket: ${toKeep.data['Ticket ID'] || toKeep._id} (Status: ${toKeep.data.Status})`);
      
      for (const doc of toDelete) {
        const status = String(doc.data.Status || '').toLowerCase();
        // Only delete if it's strictly untouched
        if (['pending', 'open', 'new'].includes(status)) {
          console.log(`  DELETING duplicate ticket: ${doc.data['Ticket ID'] || doc._id} (Status: ${doc.data.Status})`);
          await Ticket.deleteOne({ _id: doc._id });
          deletedCount++;
        } else {
          console.log(`  SKIPPING deletion for ${doc.data['Ticket ID'] || doc._id} because its status is '${doc.data.Status}' (might have been worked on)`);
        }
      }
    }
  }

  console.log(`\nSuccessfully removed ${deletedCount} untouched duplicate tickets for today.`);

  mongoose.connection.close();
}

run().catch(console.error);
