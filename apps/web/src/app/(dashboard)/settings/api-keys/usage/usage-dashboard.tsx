"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Activity,
  Coins,
  Database,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Key,
  Wrench,
  Calendar,
} from "lucide-react";
import { LoadingSpinner, EmptyState } from "@aros/ui";
import { getMcpUsageDataAction } from "./actions";

interface UsageSummary {
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

interface QuotaStatus {
  level: "normal" | "warning" | "critical";
  percentage: number;
  used: number;
  limit: number;
  message: string;
}

interface UsageDashboardProps {
  organizationId: string;
  initialDays: number;
  usageSummary: UsageSummary;
  quotaStatus: QuotaStatus;
  apiKeyNames: Record<string, string>;
}

type TimeRange = 7 | 30 | 90;

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function UsageDashboard({
  organizationId,
  initialDays,
  usageSummary,
  quotaStatus,
  apiKeyNames,
}: UsageDashboardProps) {
  const [days, setDays] = useState<TimeRange>(initialDays as TimeRange);
  const [summary, setSummary] = useState<UsageSummary>(usageSummary);
  const [quota, setQuota] = useState<QuotaStatus>(quotaStatus);
  const [isPending, startTransition] = useTransition();

  const handleTimeRangeChange = (newDays: TimeRange) => {
    if (newDays === days) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("organizationId", organizationId);
      formData.append("days", String(newDays));

      const result = await getMcpUsageDataAction(formData);
      if (result.success && result.data) {
        setSummary(result.data.summary);
        setQuota(result.data.quota);
        setDays(newDays);
      }
    });
  };

  // Sort tools by calls (descending)
  const sortedTools = useMemo(() => {
    return Object.entries(summary.byTool)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.calls - a.calls);
  }, [summary.byTool]);

  // Sort API keys by calls (descending)
  const sortedApiKeys = useMemo(() => {
    return summary.byApiKey
      .map((key) => ({
        ...key,
        name: apiKeyNames[key.apiKeyId] || `Key ${key.apiKeyId.slice(0, 8)}...`,
      }))
      .sort((a, b) => b.calls - a.calls);
  }, [summary.byApiKey, apiKeyNames]);

  // Get quota alert styles
  const getQuotaAlertStyles = () => {
    switch (quota.level) {
      case "critical":
        return "border-red-200 bg-red-50 text-red-900";
      case "warning":
        return "border-amber-200 bg-amber-50 text-amber-900";
      default:
        return "border-green-200 bg-green-50 text-green-900";
    }
  };

  const getQuotaIcon = () => {
    switch (quota.level) {
      case "critical":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      default:
        return <Activity className="h-5 w-5 text-green-600" />;
    }
  };

  const getProgressBarColor = () => {
    if (quota.percentage >= 95) return "bg-red-600";
    if (quota.percentage >= 80) return "bg-amber-500";
    return "bg-green-600";
  };

  const hasData = summary.totalCalls > 0;

  return (
    <div className="space-y-6">
      {/* Time Period Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Period:</span>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => handleTimeRangeChange(d as TimeRange)}
                disabled={isPending}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  days === d
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                } disabled:opacity-50`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>
        {isPending && <LoadingSpinner size="sm" label="Loading..." />}
      </div>

      {/* Quota Alert Banner */}
      {quota.level !== "normal" && (
        <div
          className={`rounded-xl border p-4 flex items-start gap-3 ${getQuotaAlertStyles()}`}
          role="alert"
        >
          {getQuotaIcon()}
          <div>
            <p className="font-medium">
              {quota.level === "critical"
                ? "Critical Quota Alert"
                : "Quota Warning"}
            </p>
            <p className="text-sm opacity-90 mt-0.5">{quota.message}</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total API Calls"
          value={formatNumber(summary.totalCalls)}
          icon={Activity}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <KpiCard
          label="Total Tokens"
          value={formatNumber(summary.totalTokens)}
          icon={Database}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
        />
        <KpiCard
          label="Total Cost"
          value={formatCurrency(summary.totalCost)}
          icon={Coins}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100"
        />
        <KpiCard
          label="Quota Usage"
          value={`${summary.quotaInfo.percentage}%`}
          icon={quota.level === "normal" ? TrendingUp : AlertTriangle}
          iconColor={
            quota.percentage >= 95
              ? "text-red-600"
              : quota.percentage >= 80
                ? "text-amber-600"
                : "text-green-600"
          }
          iconBg={
            quota.percentage >= 95
              ? "bg-red-100"
              : quota.percentage >= 80
                ? "bg-amber-100"
                : "bg-green-100"
          }
          subtitle={
            summary.quotaInfo.limit > 0
              ? `${formatNumber(summary.quotaInfo.used)} / ${formatNumber(summary.quotaInfo.limit)} tokens`
              : "Unlimited quota"
          }
        />
      </div>

      {/* Quota Progress Bar */}
      <div className="card">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm font-medium text-slate-900">
            Monthly Token Quota
          </p>
          <p className="text-xs text-slate-600">
            {summary.quotaInfo.limit > 0
              ? `${formatNumber(summary.quotaInfo.remaining)} remaining`
              : "No limit set"}
          </p>
        </div>
        <div
          className="h-3 rounded-full bg-slate-200"
          role="progressbar"
          aria-label="Monthly token quota usage"
          aria-valuemin={0}
          aria-valuemax={summary.quotaInfo.limit || 100}
          aria-valuenow={summary.quotaInfo.used}
        >
          <div
            className={`h-3 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
            style={{
              width: `${summary.quotaInfo.limit > 0 ? Math.min(100, summary.quotaInfo.percentage) : 0}%`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-600">
          {summary.quotaInfo.limit > 0
            ? `You've used ${formatNumber(summary.quotaInfo.used)} of your ${formatNumber(summary.quotaInfo.limit)} token limit.`
            : "Your organization has unlimited token quota."}
        </p>
      </div>

      {!hasData ? (
        <EmptyState
          icon={Activity}
          title="No usage data yet"
          description="API calls will appear here once you start using the MCP API."
          className="card py-12"
        />
      ) : (
        <>
          {/* Two Column Layout: Tool Usage + Daily Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage by Tool */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Wrench className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Usage by Tool
                </h2>
              </div>
              {sortedTools.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">
                  No tool usage data available.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 font-medium text-slate-700">
                          Tool
                        </th>
                        <th className="text-right py-2 font-medium text-slate-700">
                          Calls
                        </th>
                        <th className="text-right py-2 font-medium text-slate-700">
                          Tokens
                        </th>
                        <th className="text-right py-2 font-medium text-slate-700">
                          Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTools.map((tool) => (
                        <tr
                          key={tool.name}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                        >
                          <td className="py-2.5 text-slate-900 font-medium">
                            {tool.name.replace("aros.", "")}
                          </td>
                          <td className="py-2.5 text-right text-slate-600">
                            {formatNumber(tool.calls)}
                          </td>
                          <td className="py-2.5 text-right text-slate-600">
                            {formatNumber(tool.tokens)}
                          </td>
                          <td className="py-2.5 text-right text-slate-600">
                            {formatCurrency(tool.cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Daily Usage Trend */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Daily Trend (Last {Math.min(30, days)} Days)
                </h2>
              </div>
              {summary.dailyTrend.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">
                  No daily trend data available.
                </p>
              ) : (
                <div className="space-y-3">
                  {summary.dailyTrend.slice(-30).map((day) => (
                    <div key={day.date} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-16 shrink-0">
                        {formatDate(day.date)}
                      </span>
                      <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden">
                        <div
                          className="h-full bg-brand-500/80 rounded-md"
                          style={{
                            width: `${Math.min(100, (day.calls / Math.max(...summary.dailyTrend.slice(-30).map((d) => d.calls), 1)) * 100)}%`,
                          }}
                          title={`${day.calls} calls, ${formatNumber(day.tokens)} tokens`}
                        />
                      </div>
                      <span className="text-xs text-slate-600 w-16 text-right shrink-0">
                        {formatNumber(day.calls)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Usage by API Key */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Key className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-900">
                Usage by API Key
              </h2>
            </div>
            {sortedApiKeys.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                No API key usage data available.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2.5 font-medium text-slate-700">
                        API Key
                      </th>
                      <th className="text-right py-2.5 font-medium text-slate-700">
                        Calls
                      </th>
                      <th className="text-right py-2.5 font-medium text-slate-700">
                        Tokens
                      </th>
                      <th className="text-right py-2.5 font-medium text-slate-700">
                        Cost
                      </th>
                      <th className="text-right py-2.5 font-medium text-slate-700">
                        Avg/Call
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedApiKeys.map((key) => (
                      <tr
                        key={key.apiKeyId}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      >
                        <td className="py-3 text-slate-900 font-medium">
                          {key.name}
                        </td>
                        <td className="py-3 text-right text-slate-600">
                          {formatNumber(key.calls)}
                        </td>
                        <td className="py-3 text-right text-slate-600">
                          {formatNumber(key.tokens)}
                        </td>
                        <td className="py-3 text-right text-slate-600">
                          {formatCurrency(key.cost)}
                        </td>
                        <td className="py-3 text-right text-slate-600">
                          {key.calls > 0
                            ? formatCurrency(key.cost / key.calls)
                            : "$0.00"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200">
                    <tr className="font-medium">
                      <td className="py-3 text-slate-900">Total</td>
                      <td className="py-3 text-right text-slate-900">
                        {formatNumber(summary.totalCalls)}
                      </td>
                      <td className="py-3 text-right text-slate-900">
                        {formatNumber(summary.totalTokens)}
                      </td>
                      <td className="py-3 text-right text-slate-900">
                        {formatCurrency(summary.totalCost)}
                      </td>
                      <td className="py-3 text-right text-slate-900">
                        {summary.totalCalls > 0
                          ? formatCurrency(
                              summary.totalCost / summary.totalCalls,
                            )
                          : "$0.00"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  subtitle?: string;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  subtitle,
}: KpiCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        <div
          className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}
