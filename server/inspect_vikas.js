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
  console.log('Connected to MongoDB\n');

  const AttendanceModel = mongoose.models.Attendance || mongoose.model('Attendance', legacyRowSchema, 'attendance_legacy');

  // Let's find vikas kushwah attendance around Aug 20
  const records = await AttendanceModel.find({
    $or: [
      { 'data.Name': { $regex: /vikas/i } },
      { 'data.Employee Name': { $regex: /vikas/i } }
    ]
  });

  const targetRecords = records.filter(r => {
    const d = r.data;
    const dateField = d.Date || d.date || '';
    return String(dateField).includes('2026-08-20') || String(dateField).includes('20');
  });

  console.log(`Found ${targetRecords.length} records matching vikas and maybe 20th`);
  targetRecords.forEach(r => {
    const d = r.data;
    const dateField = d.Date || d.date || '';
    if (String(dateField).includes('08-20') || String(dateField).includes('08/20')) {
      console.log(`\nExact match found! ID: ${r._id}, legacyId: ${r.legacyId}`);
      console.log('Data:', JSON.stringify(d, null, 2));
    }
  });

  mongoose.connection.close();
}

run().catch(console.error);
