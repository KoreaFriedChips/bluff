import { Redis } from '@upstash/redis';

let redis = null;

// globalThis persists across separately-bundled route handlers in the same Node process
if (!globalThis.__bluffMemoryStore) {
  globalThis.__bluffMemoryStore = new Map();
}
const memoryStore = globalThis.__bluffMemoryStore;

function getRedis() {
  if (!redis && process.env.KV_REST_API_URL) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return redis;
}

export async function getRoom(roomId) {
  const r = getRedis();
  if (r) {
    return await r.get(`room:${roomId}`);
  }
  return memoryStore.get(roomId) || null;
}

export async function setRoom(roomId, data) {
  const r = getRedis();
  if (r) {
    await r.set(`room:${roomId}`, data, { ex: 86400 });
  } else {
    memoryStore.set(roomId, data);
  }
}
