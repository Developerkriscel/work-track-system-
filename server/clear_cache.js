import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';
import { attendanceCache, deleteByPrefix } from './services/redisCache.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  await connectDatabase();
  const key = 'attendance:location-policy'; // Assuming this is the key from attendanceCacheKey
  attendanceCache.delete(key);
  await deleteByPrefix(key);
  console.log('Cache cleared');
  process.exit(0);
}
run().catch(console.error);
