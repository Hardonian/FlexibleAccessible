"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Key, Lock, Sparkles, Users } from "lucide-react";
import {
  DASHBOARD_NAV_ITEMS,
  NAV_ICON_MAP,
  type OrgInfo,
} from "./dashboard-nav-config";
import { switchOrgAction } from "./switch-org-action";
import { AiUsageIndicator } from "../system/ai-usage-indicator";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";

interface SidebarProps {
  orgs: OrgInfo[];
  user: { id: string; email: string; name: string | null };
  canViewSystem?: boolean;
  hasPaidAccess?: boolean;
  activeOrgId?: string;
  aiUsage?: {
    enabled: boolean;
    limit: number;
    used: number;
  };
}

export function Sidebar({
  orgs,
  user,
  canViewSystem,
  hasPaidAccess,
  activeOrgId,
  aiUsage,
}: SidebarProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const currentOrgId = activeOrgId ?? orgs[0]?.id;

  return (
    <aside
      className="hidden w-64 shrink-0 flex-col border-r border-[rgb(var(--color-border))] bg-[rgb(var(--color-app-elevated))] md:flex"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex h-14 items-center border-b border-[rgb(var(--color-border))] px-4">
        <Link
          href="/dashboard"
          className="flex flex-col leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded"
        >
          <span className="text-lg font-semibold tracking-tight text-brand-800">
            {PRODUCT_DISPLAY_NAME}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            Ops console
          </span>
        </Link>
      </div>

      <div className="border-b border-[rgb(var(--color-border))] p-3">
        <label htmlFor="org-select" className="sr-only">
          Select organization
        </label>
        <form
          action={switchOrgAction}
          onChange={(e) => {
            const form = e.currentTarget;
            startTransition(() => {
              form.requestSubmit();
            });
          }}
        >
          <select
            id="org-select"
            name="organizationId"
            defaultValue={currentOrgId}
            className="input text-sm"
            disabled={isPending}
            {...(isPending
              ? { "aria-busy": "true" }
              : { "aria-busy": "false" })}
          >
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </form>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1" role="list">
          {DASHBOARD_NAV_ITEMS.map((item) => {
            const isLocked = item.premium && !hasPaidAccess;
            const isActive =
              !isLocked &&
              (pathname === item.href || pathname.startsWith(item.href + "/"));
            const Icon = NAV_ICON_MAP[item.icon];
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isLocked
                      ? "text-slate-400 hover:bg-slate-50 hover:text-slate-500"
                      : isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={isLocked ? `${item.label} — requires paid plan` : undefined}
                >
                  {Icon && (
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span className="flex-1">{item.label}</span>
                  {isLocked && (
                    <Lock className="h-3 w-3 shrink-0 text-slate-300" aria-hidden="true" />
                  )}
                </Link>
              </li>
            );
          })}
          {canViewSystem && hasPaidAccess && (
            <li className="space-y-1">
              <Link
                href="/system"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === "/system" || pathname.startsWith("/system/")
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                aria-current={
                  pathname.startsWith("/system") ? "page" : undefined
                }
              >
                <NAV_ICON_MAP.Server
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                System
              </Link>
              <ul
                className="ml-5 space-y-1 border-l border-slate-200 pl-2"
                role="list"
              >
                <li>
                  <Link
                    href="/system"
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                      pathname === "/system"
                        ? "text-brand-700"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                    aria-current={pathname === "/system" ? "page" : undefined}
                  >
                    Operator
                  </Link>
                </li>
              </ul>
            </li>
          )}
        </ul>

        <div className="mt-6">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Settings
          </div>
          <ul className="mt-1 space-y-1" role="list">
            <li>
              <Link
                href="/settings/billing"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname.startsWith("/settings/billing")
                    ? "bg-brand-50 text-brand-700"
                    : !hasPaidAccess
                      ? "text-brand-700 hover:bg-brand-50"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                aria-current={
                  pathname.startsWith("/settings/billing") ? "page" : undefined
                }
              >
                <CreditCard className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">Billing</span>
                {!hasPaidAccess && (
                  <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                    Upgrade
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link
                href="/settings/api-keys"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname.startsWith("/settings/api-keys")
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                aria-current={
                  pathname.startsWith("/settings/api-keys") ? "page" : undefined
                }
              >
                <Key className="h-4 w-4 shrink-0" aria-hidden="true" />
                API Keys
              </Link>
            </li>
            <li>
              <Link
                href="/settings/members"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname.startsWith("/settings/members")
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                aria-current={
                  pathname.startsWith("/settings/members") ? "page" : undefined
                }
              >
                <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                Members
              </Link>
            </li>
          </ul>
        </div>

        {!hasPaidAccess && (
          <div className="mt-4 px-1">
            <Link
              href="/settings/billing"
              className="flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Upgrade to unlock workspace
            </Link>
          </div>
        )}

        {aiUsage && (
          <AiUsageIndicator
            organizationId={currentOrgId}
            aiEnabled={aiUsage.enabled}
            aiTokenLimit={aiUsage.limit}
            usedTokens={aiUsage.used}
          />
        )}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
            {(user.name ?? user.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {user.name ?? "User"}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
