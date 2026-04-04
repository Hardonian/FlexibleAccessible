"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Key, Users } from "lucide-react";
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
      className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex h-14 items-center border-b border-slate-200 px-4">
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

      <div className="border-b border-slate-200 p-3">
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
          {DASHBOARD_NAV_ITEMS.filter(
            (item) => hasPaidAccess || !item.premium,
          ).map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = NAV_ICON_MAP[item.icon];
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {Icon && (
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  {item.label}
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
