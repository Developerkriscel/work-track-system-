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
  
  if (policy && policy.data && policy.data.locations) {
    let locs = typeof policy.data.locations === 'string' ? JSON.parse(policy.data.locations) : policy.data.locations;
    locs = locs.map(loc => {
      loc.addedBy = 'MS101';
      loc.addedByName = 'Mitush';
      loc.updatedAt = new Date().toISOString();
      return loc;
    });
    policy.data.locations = JSON.stringify(locs);
    policy.data.Locations = JSON.stringify(locs);
    policy.markModified('data');
    await policy.save();
    console.log('Updated locations in DB with MS101 and timestamp');
  }
  
  mongoose.connection.close();
}
run().catch(console.error);
