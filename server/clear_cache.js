import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';
import { getRedisClient } from './services/redisCache.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function clearCache() {
  await connectDatabase();
  console.log('Connected to DB');

  const redis = getRedisClient();
  if (redis) {
    const keys = await redis.keys('*ticket*');
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`Deleted ${keys.length} ticket cache keys from Redis.`);
    } else {
      console.log('No ticket cache keys found in Redis.');
    }
  } else {
    console.log('Redis client not available, assuming in-memory cache.');
  }

  // To clear the in-memory cache of the running dev server, we can just trigger a restart by touching a file.
  // We'll just touch server.js since nodemon watches it.
  import('fs').then(fs => {
    const serverJsPath = path.join(__dirname, 'server.js');
    const now = new Date();
    fs.utimesSync(serverJsPath, now, now);
    console.log('Touched server.js to trigger nodemon restart.');
  });
}

clearCache().catch(console.error).finally(() => process.exit(0));
