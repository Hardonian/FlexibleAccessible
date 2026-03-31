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

/**
 * Logs every MCP tool call for billing and analytics.
 * This is the revenue tracking layer — every call generates a billable event.
 */
export async function logToolCall(record: ToolCallRecord): Promise<void> {
  const totalTokens = record.inputTokens + record.outputTokens;

  // Cost per tool call based on complexity
  const baseCost = getToolCost(record.toolName);
  const tokenCost = totalTokens * 0.00001; // $0.01 per 1000 tokens
  const totalCost = baseCost + tokenCost;

  await prisma.mcpUsageLog.create({
    data: {
      organizationId: record.organizationId,
      apiKeyId: record.apiKeyId,
      toolName: record.toolName,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
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
  };
  return costs[toolName] ?? 0.005;
}

/**
 * Get tool usage stats for an organization.
 */
export async function getUsageStats(
  organizationId: string,
  days = 30,
): Promise<{
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  byTool: Record<string, { calls: number; cost: number }>;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await prisma.mcpUsageLog.findMany({
    where: { organizationId, createdAt: { gte: since } },
    select: { toolName: true, totalTokens: true, cost: true },
  });

  const byTool: Record<string, { calls: number; cost: number }> = {};
  let totalTokens = 0;
  let totalCost = 0;

  for (const log of logs) {
    totalTokens += log.totalTokens;
    totalCost += log.cost;
    if (!byTool[log.toolName]) {
      byTool[log.toolName] = { calls: 0, cost: 0 };
    }
    byTool[log.toolName].calls++;
    byTool[log.toolName].cost += log.cost;
  }

  return { totalCalls: logs.length, totalTokens, totalCost, byTool };
}
