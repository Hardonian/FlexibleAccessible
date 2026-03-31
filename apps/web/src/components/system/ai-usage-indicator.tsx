"use client";

import React from "react";

interface AiUsageIndicatorProps {
  organizationId: string;
  aiEnabled: boolean;
  aiTokenLimit: number;
  usedTokens: number;
}

export function AiUsageIndicator({
  organizationId: _organizationId,
  aiEnabled,
  aiTokenLimit,
  usedTokens,
}: AiUsageIndicatorProps) {
  if (!aiEnabled) {
    return (
      <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-3 shadow-sm transition-all hover:shadow-md">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-700">
          AI Remediation
        </h4>
        <p className="mt-1 text-xs text-brand-600">
          Supercharge your accessibility workflow with AI.
        </p>
        <button
          type="button"
          className="mt-2 w-full rounded bg-brand-600 px-2 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-brand-700 active:bg-brand-800"
          onClick={() => (window.location.href = "/settings")}
        >
          Activate AI Add-on
        </button>
      </div>
    );
  }

  const percentage = aiTokenLimit > 0 ? (usedTokens / aiTokenLimit) * 100 : 0;
  const isNearLimit = percentage > 80;
  const isOverLimit = percentage >= 100;

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-slate-300">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          AI Token Usage
        </h4>
        <span className="text-[10px] font-medium text-slate-400">
          {Math.round(usedTokens / 1000)}k / {Math.round(aiTokenLimit / 1000)}k
        </span>
      </div>
      
      <div className="mt-2">
        <progress
          className="h-1.5 w-full overflow-hidden rounded-full accent-brand-600 transition-all [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-brand-600"
          value={Math.min(100, percentage)}
          max={100}
        />
      </div>

      {isOverLimit && (
        <p className="mt-2 text-[10px] font-medium text-red-600">
          Quota reached. <a href="/settings" className="underline">Upgrade now</a>
        </p>
      )}
      {!isOverLimit && isNearLimit && (
        <p className="mt-2 text-[10px] font-medium text-amber-600">
          Almost out of tokens. <a href="/settings" className="underline">Add more</a>
        </p>
      )}
      {!isNearLimit && (
        <p className="mt-2 text-[10px] text-slate-400">
          Auto-generating suggestions...
        </p>
      )}
    </div>
  );
}
