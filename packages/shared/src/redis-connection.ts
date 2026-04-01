import { Redis } from 'ioredis';

/**
 * BullMQ connection options shared by web (enqueue) and worker (consume).
 * Uses URL form so BullMQ bundles a single compatible ioredis peer.
 */
export function bullmqConnectionOptions(): { url: string; maxRetriesPerRequest: null } {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(bullmqConnectionOptions().url, {
      maxRetriesPerRequest: null,
    });
  }
  return redis;
}
