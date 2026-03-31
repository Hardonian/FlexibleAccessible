import { PrismaClient } from '@prisma/client';

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
 * In a real-world scenario, this would also calculate cost based on the model.
 */
export async function logAiUsage(prisma: PrismaClient, details: AiUsageDetails) {
  const { organizationId, userId, model, promptTokens, completionTokens, purpose } = details;
  const totalTokens = promptTokens + completionTokens;

  // Simple cost calculation (placeholder rates)
  const rates: Record<string, number> = {
    'gpt-4': 0.03 / 1000,
    'gpt-3.5-turbo': 0.002 / 1000,
    'claude-3-opus': 0.015 / 1000,
    'rule-based': 0, // Mock "AI" costs nothing
  };

  const rate = rates[model] || 0;
  const cost = (totalTokens * rate);

  return await prisma.aiUsageLog.create({
    data: {
      organizationId,
      userId,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      purpose,
      cost,
    },
  });
}

/**
 * Checks if an organization is allowed to use AI features and has remaining tokens.
 */
export async function checkAiEntitlement(prisma: PrismaClient, organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: {
      aiEnabled: true,
      aiTokenLimit: true,
    },
  });

  if (!subscription || !subscription.aiEnabled) {
    return { allowed: false, reason: 'AI Add-on is not enabled for this organization' };
  }

  // Check if they've exceeded their limit
  const usage = await prisma.aiUsageLog.aggregate({
    where: { organizationId },
    _sum: { totalTokens: true },
  });

  const totalUsed = usage._sum.totalTokens || 0;
  if (subscription.aiTokenLimit > 0 && totalUsed >= subscription.aiTokenLimit) {
    return { allowed: false, reason: 'AI token limit reached for the current billing period' };
  }

  return { allowed: true };
}
