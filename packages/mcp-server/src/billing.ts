import { prisma } from "@aros/db";

export interface BillingConfig {
  trackUsage: boolean;
  enforceLimits: boolean;
}

export interface ToolCallRecord {
  organizationId: string;
  apiKeyId: string;
  toolName: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
}

export interface UsageStats {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  byTool: Record<string, { calls: number; cost: number; tokens: number }>;
}

export interface KeyUsageStats {
  apiKeyId: string;
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  byTool: Record<string, { calls: number; cost: number; tokens: number }>;
  dailyUsage: Array<{
    date: string;
    calls: number;
    tokens: number;
    cost: number;
  }>;
}

export interface OrgUsageSummary {
  organizationId: string;
  periodDays: number;
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  byTool: Record<string, { calls: number; cost: number; tokens: number }>;
  byApiKey: Array<{
    apiKeyId: string;
    calls: number;
    tokens: number;
    cost: number;
  }>;
  dailyTrend: Array<{
    date: string;
    calls: number;
    tokens: number;
    cost: number;
  }>;
  quotaInfo: {
    used: number;
    limit: number;
    percentage: number;
    remaining: number;
  };
}

export interface QuotaThresholdResult {
  level: "normal" | "warning" | "critical";
  percentage: number;
  used: number;
  limit: number;
  message: string;
}

// Token estimation multipliers for different tool types
const TOOL_TOKEN_PROFILES: Record<
  string,
  { inputMultiplier: number; outputMultiplier: number; baseOutput: number }
> = {
  // Read operations — minimal input, structured output
  "aros.list_sites": {
    inputMultiplier: 1,
    outputMultiplier: 0.5,
    baseOutput: 200,
  },
  "aros.get_site": {
    inputMultiplier: 1,
    outputMultiplier: 0.8,
    baseOutput: 400,
  },
  "aros.list_findings": {
    inputMultiplier: 1.2,
    outputMultiplier: 1.5,
    baseOutput: 800,
  },
  "aros.get_finding": {
    inputMultiplier: 1,
    outputMultiplier: 2,
    baseOutput: 1000,
  },
  "aros.list_clusters": {
    inputMultiplier: 1,
    outputMultiplier: 1,
    baseOutput: 500,
  },
  "aros.get_cluster": {
    inputMultiplier: 1,
    outputMultiplier: 1.5,
    baseOutput: 900,
  },
  "aros.list_suggestions": {
    inputMultiplier: 1,
    outputMultiplier: 1,
    baseOutput: 600,
  },
  "aros.get_suggestion": {
    inputMultiplier: 1,
    outputMultiplier: 1.2,
    baseOutput: 700,
  },
  "aros.list_scan_runs": {
    inputMultiplier: 1,
    outputMultiplier: 0.6,
    baseOutput: 300,
  },
  "aros.get_scan_status": {
    inputMultiplier: 1,
    outputMultiplier: 0.5,
    baseOutput: 200,
  },
  "aros.get_reports": {
    inputMultiplier: 1,
    outputMultiplier: 2,
    baseOutput: 1200,
  },

  // Write operations — moderate input, confirmation output
  "aros.start_crawl": {
    inputMultiplier: 1.5,
    outputMultiplier: 0.8,
    baseOutput: 300,
  },
  "aros.start_scan": {
    inputMultiplier: 1.5,
    outputMultiplier: 0.8,
    baseOutput: 300,
  },
  "aros.approve_suggestion": {
    inputMultiplier: 1.2,
    outputMultiplier: 0.5,
    baseOutput: 200,
  },
  "aros.reject_suggestion": {
    inputMultiplier: 1.2,
    outputMultiplier: 0.5,
    baseOutput: 200,
  },

  // AI operations — large input/output for LLM context
  "aros.generate_fix": {
    inputMultiplier: 3,
    outputMultiplier: 4,
    baseOutput: 3000,
  },
  "aros.batch_generate_fixes": {
    inputMultiplier: 5,
    outputMultiplier: 6,
    baseOutput: 5000,
  },
  "aros.analyze_site": {
    inputMultiplier: 4,
    outputMultiplier: 5,
    baseOutput: 4000,
  },

  // Export operations — variable input, large structured output
  "aros.create_pr": {
    inputMultiplier: 2,
    outputMultiplier: 1.5,
    baseOutput: 1000,
  },
  "aros.export_findings": {
    inputMultiplier: 1.5,
    outputMultiplier: 3,
    baseOutput: 2000,
  },
  "aros.get_conformance_report": {
    inputMultiplier: 1.5,
    outputMultiplier: 2.5,
    baseOutput: 1500,
  },

  // Knowledge base operations
  "aros.get_wcag_criterion": {
    inputMultiplier: 1,
    outputMultiplier: 1.5,
    baseOutput: 800,
  },
  "aros.get_usage": {
    inputMultiplier: 1,
    outputMultiplier: 1,
    baseOutput: 500,
  },
};

/**
 * Estimate output tokens based on tool type and input size.
 * Uses tool-specific profiles for more accurate billing.
 */
export function estimateTokens(
  toolName: string,
  inputTokens: number,
): { inputTokens: number; outputTokens: number } {
  const profile = TOOL_TOKEN_PROFILES[toolName] ?? {
    inputMultiplier: 1,
    outputMultiplier: 1,
    baseOutput: 500,
  };

  const adjustedInput = Math.round(inputTokens * profile.inputMultiplier);
  const estimatedOutput = Math.round(
    profile.baseOutput + adjustedInput * profile.outputMultiplier * 0.1,
  );

  return { inputTokens: adjustedInput, outputTokens: estimatedOutput };
}

/**
 * Logs every MCP tool call for billing and analytics.
 * This is the revenue tracking layer — every call generates a billable event.
 */
export async function logToolCall(record: ToolCallRecord): Promise<void> {
  // Apply tool-specific token estimation for more accurate billing
  const estimated = estimateTokens(record.toolName, record.inputTokens);
  const finalInputTokens = estimated.inputTokens;
  const finalOutputTokens = record.outputTokens || estimated.outputTokens;
  const totalTokens = finalInputTokens + finalOutputTokens;

  // Cost per tool call based on complexity
  const baseCost = getToolCost(record.toolName);
  const tokenCost = totalTokens * 0.00001; // $0.01 per 1000 tokens
  const totalCost = baseCost + tokenCost;

  await prisma.mcpUsageLog.create({
    data: {
      organizationId: record.organizationId,
      apiKeyId: record.apiKeyId,
      toolName: record.toolName,
      inputTokens: finalInputTokens,
      outputTokens: finalOutputTokens,
      totalTokens,
      durationMs: record.durationMs,
      cost: totalCost,
      success: record.success,
      errorMessage: record.errorMessage,
    },
  });

  // Update rolling totals for rate enforcement
  await prisma.organization.update({
    where: { id: record.organizationId },
    data: {
      mcpUsageThisPeriod: { increment: totalTokens },
    },
  });
}

/**
 * Check if the organization has remaining MCP API quota.
 */
export async function checkMcpQuota(
  organizationId: string,
): Promise<{ allowed: boolean; used: number; limit: number; reason?: string }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      mcpUsageThisPeriod: true,
      mcpTokenLimit: true,
      mcpEnabled: true,
    },
  });

  if (!org)
    return {
      allowed: false,
      used: 0,
      limit: 0,
      reason: "Organization not found",
    };
  if (!org.mcpEnabled)
    return {
      allowed: false,
      used: 0,
      limit: 0,
      reason:
        "MCP API access not enabled. Upgrade to Professional plan or add the MCP API add-on.",
    };

  const limit = org.mcpTokenLimit;
  if (limit > 0 && org.mcpUsageThisPeriod >= limit) {
    return {
      allowed: false,
      used: org.mcpUsageThisPeriod,
      limit,
      reason: `MCP API quota exceeded. Used ${org.mcpUsageThisPeriod.toLocaleString()} of ${limit.toLocaleString()} tokens this period. Upgrade your plan for more capacity.`,
    };
  }

  return { allowed: true, used: org.mcpUsageThisPeriod, limit };
}

/**
 * Check quota threshold and return alert level.
 * Returns warning at 80%, critical at 95%, and critical at 100%.
 */
export async function checkQuotaThreshold(
  organizationId: string,
): Promise<QuotaThresholdResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      mcpUsageThisPeriod: true,
      mcpTokenLimit: true,
      mcpEnabled: true,
      name: true,
    },
  });

  if (!org) {
    return {
      level: "critical",
      percentage: 100,
      used: 0,
      limit: 0,
      message: "Organization not found",
    };
  }

  if (!org.mcpEnabled) {
    return {
      level: "critical",
      percentage: 100,
      used: 0,
      limit: 0,
      message: "MCP API access not enabled",
    };
  }

  const limit = org.mcpTokenLimit;
  const used = org.mcpUsageThisPeriod;

  // No limit set (unlimited)
  if (limit <= 0) {
    return {
      level: "normal",
      percentage: 0,
      used,
      limit: 0,
      message: "Unlimited quota",
    };
  }

  const percentage = Math.min(100, Math.round((used / limit) * 100));

  if (percentage >= 100) {
    return {
      level: "critical",
      percentage,
      used,
      limit,
      message: `Quota exhausted: ${used.toLocaleString()} of ${limit.toLocaleString()} tokens (${percentage}%). MCP API calls are now blocked.`,
    };
  }

  if (percentage >= 95) {
    return {
      level: "critical",
      percentage,
      used,
      limit,
      message: `Critical quota usage: ${used.toLocaleString()} of ${limit.toLocaleString()} tokens (${percentage}%). Upgrade recommended immediately.`,
    };
  }

  if (percentage >= 80) {
    return {
      level: "warning",
      percentage,
      used,
      limit,
      message: `High quota usage: ${used.toLocaleString()} of ${limit.toLocaleString()} tokens (${percentage}%). Consider upgrading your plan.`,
    };
  }

  return {
    level: "normal",
    percentage,
    used,
    limit,
    message: `Quota usage: ${used.toLocaleString()} of ${limit.toLocaleString()} tokens (${percentage}%)`,
  };
}

/**
 * Per-tool base cost. High-complexity tools cost more.
 */
function getToolCost(toolName: string): number {
  const costs: Record<string, number> = {
    // Read operations — cheap
    "aros.list_sites": 0.001,
    "aros.get_site": 0.001,
    "aros.list_findings": 0.002,
    "aros.get_finding": 0.001,
    "aros.list_clusters": 0.002,
    "aros.get_cluster": 0.001,
    "aros.list_suggestions": 0.002,
    "aros.get_suggestion": 0.001,
    "aros.list_scan_runs": 0.001,
    "aros.get_scan_status": 0.001,
    "aros.get_reports": 0.003,

    // Write operations — moderate
    "aros.start_crawl": 0.01,
    "aros.start_scan": 0.01,
    "aros.approve_suggestion": 0.005,
    "aros.reject_suggestion": 0.005,

    // AI operations — expensive
    "aros.generate_fix": 0.05,
    "aros.batch_generate_fixes": 0.1,
    "aros.analyze_site": 0.08,

    // Export operations — moderate
    "aros.create_pr": 0.02,
    "aros.export_findings": 0.005,
    "aros.get_conformance_report": 0.03,

    // Knowledge base operations
    "aros.get_wcag_criterion": 0.001,
    "aros.get_usage": 0.001,
  };
  return costs[toolName] ?? 0.005;
}

/**
 * Get tool usage stats for an organization with time window filtering.
 */
export async function getUsageStats(
  organizationId: string,
  days = 30,
): Promise<UsageStats> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await prisma.mcpUsageLog.findMany({
    where: { organizationId, createdAt: { gte: since } },
    select: { toolName: true, totalTokens: true, cost: true },
  });

  const byTool: Record<
    string,
    { calls: number; cost: number; tokens: number }
  > = {};
  let totalTokens = 0;
  let totalCost = 0;

  for (const log of logs) {
    totalTokens += log.totalTokens;
    totalCost += log.cost;
    if (!byTool[log.toolName]) {
      byTool[log.toolName] = { calls: 0, cost: 0, tokens: 0 };
    }
    byTool[log.toolName].calls++;
    byTool[log.toolName].cost += log.cost;
    byTool[log.toolName].tokens += log.totalTokens;
  }

  return { totalCalls: logs.length, totalTokens, totalCost, byTool };
}

/**
 * Get usage stats for a specific API key with daily aggregation.
 */
export async function getKeyUsageStats(
  apiKeyId: string,
  days = 30,
): Promise<KeyUsageStats> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await prisma.mcpUsageLog.findMany({
    where: { apiKeyId, createdAt: { gte: since } },
    select: {
      toolName: true,
      totalTokens: true,
      cost: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const byTool: Record<
    string,
    { calls: number; cost: number; tokens: number }
  > = {};
  const dailyMap = new Map<
    string,
    { calls: number; tokens: number; cost: number }
  >();
  let totalTokens = 0;
  let totalCost = 0;

  for (const log of logs) {
    totalTokens += log.totalTokens;
    totalCost += log.cost;

    // Aggregate by tool
    if (!byTool[log.toolName]) {
      byTool[log.toolName] = { calls: 0, cost: 0, tokens: 0 };
    }
    byTool[log.toolName].calls++;
    byTool[log.toolName].cost += log.cost;
    byTool[log.toolName].tokens += log.totalTokens;

    // Aggregate by day
    const dateKey = log.createdAt.toISOString().split("T")[0];
    const existing = dailyMap.get(dateKey) ?? { calls: 0, tokens: 0, cost: 0 };
    dailyMap.set(dateKey, {
      calls: existing.calls + 1,
      tokens: existing.tokens + log.totalTokens,
      cost: existing.cost + log.cost,
    });
  }

  // Convert daily map to sorted array
  const dailyUsage = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, ...stats }));

  return {
    apiKeyId,
    totalCalls: logs.length,
    totalTokens,
    totalCost,
    byTool,
    dailyUsage,
  };
}

/**
 * Get organization-level usage summary with trends and quota information.
 */
export async function getOrgUsageSummary(
  organizationId: string,
  days = 30,
): Promise<OrgUsageSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Fetch all usage logs for the period
  const logs = await prisma.mcpUsageLog.findMany({
    where: { organizationId, createdAt: { gte: since } },
    select: {
      toolName: true,
      apiKeyId: true,
      totalTokens: true,
      cost: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch organization quota info
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      mcpUsageThisPeriod: true,
      mcpTokenLimit: true,
    },
  });

  // Aggregate by tool
  const byTool: Record<
    string,
    { calls: number; cost: number; tokens: number }
  > = {};

  // Aggregate by API key
  const keyMap = new Map<
    string,
    { calls: number; tokens: number; cost: number }
  >();

  // Aggregate by day
  const dailyMap = new Map<
    string,
    { calls: number; tokens: number; cost: number }
  >();

  let totalTokens = 0;
  let totalCost = 0;

  for (const log of logs) {
    totalTokens += log.totalTokens;
    totalCost += log.cost;

    // By tool
    if (!byTool[log.toolName]) {
      byTool[log.toolName] = { calls: 0, cost: 0, tokens: 0 };
    }
    byTool[log.toolName].calls++;
    byTool[log.toolName].cost += log.cost;
    byTool[log.toolName].tokens += log.totalTokens;

    // By API key
    const keyStats = keyMap.get(log.apiKeyId) ?? {
      calls: 0,
      tokens: 0,
      cost: 0,
    };
    keyMap.set(log.apiKeyId, {
      calls: keyStats.calls + 1,
      tokens: keyStats.tokens + log.totalTokens,
      cost: keyStats.cost + log.cost,
    });

    // By day
    const dateKey = log.createdAt.toISOString().split("T")[0];
    const dailyStats = dailyMap.get(dateKey) ?? {
      calls: 0,
      tokens: 0,
      cost: 0,
    };
    dailyMap.set(dateKey, {
      calls: dailyStats.calls + 1,
      tokens: dailyStats.tokens + log.totalTokens,
      cost: dailyStats.cost + log.cost,
    });
  }

  // Convert maps to arrays
  const byApiKey = Array.from(keyMap.entries()).map(([apiKeyId, stats]) => ({
    apiKeyId,
    ...stats,
  }));

  const dailyTrend = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, ...stats }));

  const limit = org?.mcpTokenLimit ?? 0;
  const used = org?.mcpUsageThisPeriod ?? 0;

  return {
    organizationId,
    periodDays: days,
    totalCalls: logs.length,
    totalTokens,
    totalCost,
    byTool,
    byApiKey,
    dailyTrend,
    quotaInfo: {
      used,
      limit,
      percentage: limit > 0 ? Math.round((used / limit) * 100) : 0,
      remaining: limit > 0 ? Math.max(0, limit - used) : 0,
    },
  };
}
