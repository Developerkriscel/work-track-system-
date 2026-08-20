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

  const records = await AttendanceModel.find({ 'data.Date': /2026-08-18|8\/18\/2026/ }).limit(3);
  for (let r of records) {
     console.log(JSON.stringify(r.data, null, 2));
  }
  if (records.length === 0) {
      console.log('No records found for Aug 18');
  }

  mongoose.connection.close();
}

run().catch(console.error);
