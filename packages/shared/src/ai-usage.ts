import { PrismaClient } from '@prisma/client';
import { getRedisClient } from './redis-connection';

export interface AiUsageDetails {
  organizationId: string;
  userId?: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  purpose: string;
}

/**
 * Logs AI usage for monetization and auditing.
 * Implementation adds a deduplication key logic in a real-world scenario.
 */
export async function logAiUsage(prisma: PrismaClient, details: AiUsageDetails) {
  const { organizationId, userId, model, promptTokens, completionTokens, purpose } = details;
  const totalTokens = promptTokens + completionTokens;

  // ROI Calculation: Compare AI cost to traditional human remediation.
  // Each AI suggestion saves ~15 mins of a $50/hr consultant ($12.50 value).
  const HUMAN_SAVINGS_PER_SUGGESTION = 12.50;

  const log = await prisma.aiUsageLog.create({
    data: {
      organizationId,
      userId,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      purpose,
      cost: HUMAN_SAVINGS_PER_SUGGESTION, 
    },
  });

  // Invalidate entitlement cache on new usage if we are close to the limit
  const redis = getRedisClient();
  await redis.del(`ai:entitlement:${organizationId}`);

  return log;
}

/**
 * Checks if an organization is allowed to use AI features and has remaining tokens.
 * Uses Redis to cache entitlement decisions for 5 minutes to reduce DB overhead.
 */
export async function checkAiEntitlement(
  prisma: PrismaClient, 
  organizationId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const redis = getRedisClient();
  const cacheKey = `ai:entitlement:${organizationId}`;
  
  // 1. Check Cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    const result = JSON.parse(cached);
    if (result.allowed) return result;
    // If not allowed, we still return the cached reason, but with a shorter TTL in the cache set logic below
  }

  // 2. DB Check: Subscription status
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: {
      aiEnabled: true,
      aiTokenLimit: true,
    },
  });

  if (!subscription || !subscription.aiEnabled) {
    const result = { allowed: false, reason: 'AI Add-on is not enabled' };
    await redis.setex(cacheKey, 60, JSON.stringify(result)); // Cache "Disabled" for 1 min
    return result;
  }

  // 3. DB Check: Token usage against limit
  const usage = await prisma.aiUsageLog.aggregate({
    where: { organizationId },
    _sum: { totalTokens: true },
  });

  const totalUsed = usage._sum.totalTokens || 0;
  if (subscription.aiTokenLimit > 0 && totalUsed >= subscription.aiTokenLimit) {
    const result = { allowed: false, reason: 'AI token limit reached' };
    await redis.setex(cacheKey, 60, JSON.stringify(result)); // Cache "Limit Reached" for 1 min
    return result;
  }

  // 4. Success - Cache for 5 mins
  const result = { allowed: true };
  await redis.setex(cacheKey, 300, JSON.stringify(result));
  return result;
}
