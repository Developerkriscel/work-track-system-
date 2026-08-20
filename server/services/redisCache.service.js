import { createClient } from 'redis';

const REDIS_URL = String(process.env.REDIS_URL || process.env.REDIS_URI || '').trim();
const REDIS_PREFIX = String(process.env.WORKTRACK_REDIS_PREFIX || 'worktrack').trim() || 'worktrack';
const REDIS_DISABLED_RETRY_MS = Number(process.env.WORKTRACK_REDIS_DISABLED_RETRY_MS || 60_000);

let redisClient = null;
let redisConnectPromise = null;
let redisDisabledUntil = 0;
let redisFailureLogged = false;

function hasRedisConfig() {
  return Boolean(REDIS_URL);
}

function buildRedisKey(...parts) {
  return [REDIS_PREFIX, ...parts.map((part) => String(part ?? '').trim()).filter(Boolean)].join(':');
}

async function getRedisClient() {
  if (!hasRedisConfig()) return null;
  if (Date.now() < redisDisabledUntil) return null;
  if (redisClient?.isReady) return redisClient;
  if (redisConnectPromise) return redisConnectPromise;

  redisClient = createClient({ url: REDIS_URL });
  redisClient.on('error', () => {
    // Connection errors are handled by the connect() rejection path.
  });

  redisConnectPromise = redisClient.connect()
    .then(() => {
      redisConnectPromise = null;
      redisFailureLogged = false;
      return redisClient;
    })
    .catch((error) => {
      if (!redisFailureLogged && process.env.NODE_ENV !== 'test') {
        redisFailureLogged = true;
        console.warn(`Redis cache disabled: ${error.message}`);
      }
      redisDisabledUntil = Date.now() + REDIS_DISABLED_RETRY_MS;
      redisConnectPromise = null;
      redisClient = null;
      return null;
    });

  return redisConnectPromise;
}

async function getJson(cacheKey) {
  try {
    const client = await getRedisClient();
    if (!client) return null;
    const raw = await client.get(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

async function setJson(cacheKey, value, ttlMs) {
  try {
    const client = await getRedisClient();
    if (!client) return false;
    const serialized = JSON.stringify(value);
    if (Number.isFinite(ttlMs) && ttlMs > 0) {
      if (typeof client.pSetEx === 'function') {
        await client.pSetEx(cacheKey, Math.round(ttlMs), serialized);
      } else if (typeof client.setEx === 'function') {
        await client.setEx(cacheKey, Math.max(1, Math.ceil(ttlMs / 1000)), serialized);
      } else {
        await client.set(cacheKey, serialized, { PX: Math.round(ttlMs) });
      }
    } else {
      await client.set(cacheKey, serialized);
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function deleteKey(cacheKey) {
  try {
    const client = await getRedisClient();
    if (!client) return false;
    await client.del(cacheKey);
    return true;
  } catch (err) {
    return false;
  }
}

async function deleteByPrefix(prefix) {
  try {
    const client = await getRedisClient();
    if (!client) return 0;
    const pattern = `${prefix}*`;
    const keys = [];
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }
    if (keys.length) {
      await client.del(keys.length === 1 ? keys[0] : keys);
    }
    return keys.length;
  } catch (err) {
    return 0;
  }
}

export {
  buildRedisKey,
  deleteByPrefix,
  deleteKey,
  getJson,
  hasRedisConfig,
  setJson
};
