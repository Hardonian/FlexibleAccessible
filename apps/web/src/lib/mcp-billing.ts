/**
 * MCP Billing utilities for the web app.
 * Re-exports and wraps functions from @aros/mcp-server for server-side usage.
 */

import {
  getOrgUsageSummary as getOrgUsageSummaryInternal,
  checkQuotaThreshold as checkQuotaThresholdInternal,
  getUsageStats,
  getKeyUsageStats,
  checkMcpQuota,
  type OrgUsageSummary,
  type QuotaThresholdResult,
  type UsageStats,
  type KeyUsageStats,
} from "@aros/mcp-server/billing";

export type {
  OrgUsageSummary,
  QuotaThresholdResult,
  UsageStats,
  KeyUsageStats,
  ToolCallRecord,
} from "@aros/mcp-server/billing";

/**
 * Get organization-level usage summary with trends and quota information.
 */
export async function getOrgUsageSummary(
  organizationId: string,
  days?: number,
): Promise<OrgUsageSummary> {
  return getOrgUsageSummaryInternal(organizationId, days);
}

/**
 * Check quota threshold and return alert level.
 * Returns warning at 80%, critical at 95%, and critical at 100%.
 */
export async function checkQuotaThreshold(
  organizationId: string,
): Promise<QuotaThresholdResult> {
  return checkQuotaThresholdInternal(organizationId);
}

/**
 * Get tool usage stats for an organization with time window filtering.
 */
export async function getMcpUsageStats(
  organizationId: string,
  days?: number,
): Promise<UsageStats> {
  return getUsageStats(organizationId, days);
}

/**
 * Get usage stats for a specific API key with daily aggregation.
 */
export async function getMcpKeyUsageStats(
  apiKeyId: string,
  days?: number,
): Promise<KeyUsageStats> {
  return getKeyUsageStats(apiKeyId, days);
}

/**
 * Check if the organization has remaining MCP API quota.
 */
export async function checkMcpQuotaStatus(organizationId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  reason?: string;
}> {
  return checkMcpQuota(organizationId);
}
