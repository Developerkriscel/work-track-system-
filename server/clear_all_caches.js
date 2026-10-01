import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  try {
     const { deleteByPrefix } = await import('./services/redisCache.service.js');
     await deleteByPrefix('attendance');
     console.log('Cleared redis cache for attendance');
  } catch (e) {
     console.error(e);
  }
  process.exit(0);
}

run();
