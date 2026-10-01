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

  // Update Punch In time for ATT_1787201200169
  const result = await AttendanceModel.updateOne(
    { legacyId: 'ATT_1787201200169' },
    { 
      $set: { 
        'data.Punch In': '10:14:18 am',
        'data.Time': '2026-08-20T04:44:18.000Z',
        'data.Status': 'Present' // Fix status if needed
      } 
    }
  );

  console.log('Update result:', result);

  // Re-fetch to verify
  const updated = await AttendanceModel.findOne({ legacyId: 'ATT_1787201200169' });
  console.log('Updated Data:', JSON.stringify(updated.data, null, 2));

  mongoose.connection.close();
}

run().catch(console.error);
