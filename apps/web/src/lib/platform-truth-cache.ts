import { cache } from 'react';
import { collectPlatformHealth, buildRoutePlatformTruth, type RoutePlatformTruth } from '@aros/core-services';
import { prisma } from './db';

/**
 * One platform-truth snapshot per request (React cache).
 * Derives from collectPlatformHealth — never fabricates readiness.
 */
export const getRoutePlatformTruth = cache(async (): Promise<RoutePlatformTruth> => {
  const report = await collectPlatformHealth(prisma);
  return buildRoutePlatformTruth(report);
});
