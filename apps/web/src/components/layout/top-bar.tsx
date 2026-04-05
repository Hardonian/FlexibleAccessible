'use client';

import Link from 'next/link';
import { logoutAction } from './logout-action';
import type { RoutePlatformTruth } from '@aros/core-services';
import { MobileNavMenuButton } from './mobile-nav-menu-button';

interface TopBarProps {
  user: { id: string; email: string; name: string | null };
  organizationName?: string;
  platformTruth?: RoutePlatformTruth | null;
  canViewSystem?: boolean;
}

export function TopBar({
  user,
  organizationName,
  platformTruth,
  canViewSystem = false,
}: TopBarProps) {
  const degraded =
    platformTruth &&
    platformTruth.shellBlocker === 'none' &&
    (platformTruth.readiness === 'degraded' ||
      !platformTruth.flags.workerRunning ||
      platformTruth.optionalSubsystemIssues.length > 0);

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-app-elevated))] px-4 md:px-6"
      style={{ paddingTop: 'max(0px, env(safe-area-inset-top))' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <MobileNavMenuButton />
        {organizationName ? (
          <span className="min-w-0 max-w-[10rem] truncate text-xs font-semibold text-slate-800 sm:max-w-[14rem] sm:text-sm">
            {organizationName}
          </span>
        ) : null}
        {degraded && (
          <p
            className="min-w-0 flex-1 truncate text-xs text-amber-950 sm:text-sm md:max-w-none md:whitespace-normal"
            role="status"
          >
            <span className="font-semibold">Platform degraded.</span>
            {!platformTruth.flags.workerRunning && " Background jobs may not run."}
            {platformTruth.optionalSubsystemIssues.length > 0 &&
              " Some integrations unavailable."}
            {canViewSystem && (
              <>
                {" "}
                <Link
                  href="/system"
                  className="font-medium underline underline-offset-2"
                >
                  System status
                </Link>
              </>
            )}
          </p>
        )}
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-2 md:gap-4">
        <span className="hidden max-w-[40vw] truncate text-sm text-slate-500 sm:inline md:max-w-[28vw]">
          {user.name ?? user.email}
        </span>
        <form action={logoutAction}>
          <button type="submit" className="btn-ghost min-h-[44px] text-sm">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
