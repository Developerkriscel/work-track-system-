import Redis from 'ioredis';
async function run() {
  const redis = new Redis();
  await redis.flushall();
  console.log('Redis flushed');
  process.exit(0);
}
run();
