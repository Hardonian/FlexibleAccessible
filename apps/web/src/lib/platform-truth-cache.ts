import { cache } from 'react';
import { collectPlatformHealth, buildRoutePlatformTruth, type RoutePlatformTruth } from '@aros/core-services';
import { prisma } from './db';
import { getRedisClient } from '@aros/shared';

/**
 * Enhanced Truth Provider:
 * 1. Redis Level (30s TTL) - Shared across all workers/web-nodes.
 * 2. React Level (Request TTL) - Deduplicates within a single render cycle.
 */
export const getRoutePlatformTruth = cache(async (): Promise<RoutePlatformTruth> => {
  const redis = getRedisClient();
  const cacheKey = 'platform:truth:v1';
  
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const report = await collectPlatformHealth(prisma);
  const truth = buildRoutePlatformTruth(report);
  
  await redis.setex(cacheKey, 30, JSON.stringify(truth));
  
  return truth;
});
