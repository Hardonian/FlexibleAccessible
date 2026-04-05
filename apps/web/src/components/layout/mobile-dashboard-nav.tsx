"use client";

import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Key, Users } from "lucide-react";
import {
  DASHBOARD_NAV_ITEMS,
  NAV_ICON_MAP,
  type OrgInfo,
} from "./dashboard-nav-config";
import { useDashboardNav } from "./dashboard-nav-context";
import { switchOrgAction } from "./switch-org-action";
import { AiUsageIndicator } from "../system/ai-usage-indicator";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";

interface MobileDashboardNavProps {
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

export function MobileDashboardNav({
  orgs,
  user,
  canViewSystem,
  hasPaidAccess,
  activeOrgId,
  aiUsage,
}: MobileDashboardNavProps) {
  const pathname = usePathname();
  const { mobileNavOpen, closeMobileNav } = useDashboardNav();
  const containerRef = useRef<HTMLDivElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const [isPending, startTransition] = useTransition();

  const currentOrgId = activeOrgId ?? orgs[0]?.id;

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const root = containerRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMobileNav();
        return;
      }
      if (e.key !== "Tab" || !root) return;
      const selectors =
        'a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(selectors)).filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const trigger = closeButtonRef.current;
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    queueMicrotask(() => firstLinkRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      trigger?.focus();
    };
  }, [mobileNavOpen, closeMobileNav]);

  if (!mobileNavOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Main menu"
    >
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Close menu"
        onClick={() => {
          closeMobileNav();
          closeButtonRef.current?.focus();
        }}
      />
      <aside
        className="absolute left-0 top-0 flex h-full w-[min(20rem,88vw)] flex-col border-r border-[rgb(var(--color-border))] bg-[rgb(var(--color-app-elevated))] shadow-xl pt-[env(safe-area-inset-top)]"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[rgb(var(--color-border))] px-4">
          <Link
            href="/dashboard"
            className="text-lg font-semibold tracking-tight text-brand-800"
            onClick={closeMobileNav}
          >
            {PRODUCT_DISPLAY_NAME}
          </Link>
          <button
            type="button"
            ref={closeButtonRef}
            className="btn-ghost min-h-[44px] min-w-[44px] px-3"
            onClick={closeMobileNav}
            aria-label="Close navigation"
          >
            <NAV_ICON_MAP.Close className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-[rgb(var(--color-border))] p-3">
          <label htmlFor="org-select-mobile" className="sr-only">
            Select organization
          </label>
          <form
            action={switchOrgAction}
            onChange={(e) => {
              const form = e.currentTarget;
              startTransition(() => {
                form.requestSubmit();
                closeMobileNav();
              });
            }}
          >
            <select
              id="org-select-mobile"
              name="organizationId"
              className="input text-sm"
              defaultValue={currentOrgId}
              disabled={isPending || orgs.length === 0}
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

        <nav className="flex-1 overflow-y-auto p-3" aria-label="Main">
          <ul className="space-y-1" role="list">
            {DASHBOARD_NAV_ITEMS.filter(
              (item) => hasPaidAccess || !item.premium,
            ).map((item, i) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = NAV_ICON_MAP[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={item.href}
                    className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={closeMobileNav}
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
              <li>
                <Link
                  href="/system"
                  className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    pathname === "/system" || pathname.startsWith("/system/")
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                  aria-current={
                    pathname.startsWith("/system") ? "page" : undefined
                  }
                  onClick={closeMobileNav}
                >
                  <NAV_ICON_MAP.Server
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  System
                </Link>
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
                  className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    pathname.startsWith("/settings/api-keys")
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                  aria-current={
                    pathname.startsWith("/settings/api-keys") ? "page" : undefined
                  }
                  onClick={closeMobileNav}
                >
                  <Key className="h-4 w-4 shrink-0" aria-hidden="true" />
                  API Keys
                </Link>
              </li>
              <li>
                <Link
                  href="/settings/members"
                  className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    pathname.startsWith("/settings/members")
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                  aria-current={
                    pathname.startsWith("/settings/members") ? "page" : undefined
                  }
                  onClick={closeMobileNav}
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

        <div className="border-t border-[rgb(var(--color-border))] p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
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
    </div>
  );
}
