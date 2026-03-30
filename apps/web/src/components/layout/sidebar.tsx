"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  DASHBOARD_NAV_ITEMS,
  NAV_ICON_MAP,
  type OrgInfo,
} from "./dashboard-nav-config";

interface SidebarProps {
  orgs: OrgInfo[];
  user: { id: string; email: string; name: string | null };
  canViewSystem?: boolean;
}

export function Sidebar({ orgs, user, canViewSystem }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentOrg, setCurrentOrg] = useState(orgs[0]);

  useEffect(() => {
    if (orgs.length === 0) return;
    setCurrentOrg((prev) => {
      if (prev && orgs.some((o) => o.id === prev.id)) return prev;
      return orgs[0];
    });
  }, [orgs]);

  return (
    <aside
      className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex h-14 items-center border-b border-slate-200 px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-bold text-brand-600">AROS</span>
        </Link>
      </div>

      <div className="border-b border-slate-200 p-3">
        <label htmlFor="org-select" className="sr-only">
          Select organization
        </label>
        <select
          id="org-select"
          value={currentOrg?.id ?? ""}
          onChange={(e) => {
            const org = orgs.find((o) => o.id === e.target.value);
            if (org) {
              setCurrentOrg(org);
              router.refresh();
            }
          }}
          className="input text-sm"
        >
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1" role="list">
          {DASHBOARD_NAV_ITEMS.map((item) => {
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
          {canViewSystem && (
            <li>
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
            </li>
          )}
        </ul>
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
