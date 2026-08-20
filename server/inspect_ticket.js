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

  const tickets = await TicketModel.find({ legacyId: /TICKET_20260810/ }).limit(3);
  for (let t of tickets) {
     console.log(JSON.stringify(t.data, null, 2));
  }

  mongoose.connection.close();
}

run().catch(console.error);
