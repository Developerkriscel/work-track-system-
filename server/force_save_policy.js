import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';
import { updateAttendanceLocationPolicy, getAttendanceLocationPolicy } from './services/attendance.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  await connectDatabase();
  const current = await getAttendanceLocationPolicy();
  await updateAttendanceLocationPolicy('MS101', 'Super Admin', { locations: current.locations });
  console.log('Policy re-saved, cache should be cleared');
  process.exit(0);
}
run().catch(console.error);
