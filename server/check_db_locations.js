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
  const PolicyModel = mongoose.models.AttendancePolicy || mongoose.model('AttendancePolicy', legacyRowSchema, 'attendance_policy_legacy');

  const policy = await PolicyModel.findOne({ legacyId: 'ATTENDANCE_LOCATION_POLICY' });
  console.log(policy?.data?.locations);
  console.log(policy?.data?.Locations);
  
  mongoose.connection.close();
}
run().catch(console.error);
