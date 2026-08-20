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

  const ticketsToUpdate = await TicketModel.find({});
  let updatedCount = 0;

  for (let doc of ticketsToUpdate) {
    let needsUpdate = false;
    let newData = { ...doc.data };

    if (newData['TAT Minutes'] !== undefined) {
      newData['TAT'] = newData['TAT Minutes'];
      delete newData['TAT Minutes'];
      needsUpdate = true;
    }

    if (newData['Actual Duration'] !== undefined) {
      newData['Total Duration'] = newData['Actual Duration'];
      newData['Duration'] = newData['Actual Duration'];
      delete newData['Actual Duration'];
      needsUpdate = true;
    }

    if (needsUpdate) {
      await TicketModel.updateOne({ _id: doc._id }, { $set: { data: newData } });
      updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} tickets.`);

  mongoose.connection.close();
}

run().catch(console.error);
