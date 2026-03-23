import Link from 'next/link';
import { logoutAction } from './logout-action';
import type { RoutePlatformTruth } from '@aros/core-services';

interface TopBarProps {
  user: { id: string; email: string; name: string | null };
  platformTruth?: RoutePlatformTruth | null;
  canViewSystem?: boolean;
}

export function TopBar({ user, platformTruth, canViewSystem = false }: TopBarProps) {
  const degraded =
    platformTruth &&
    platformTruth.shellBlocker === 'none' &&
    (platformTruth.readiness === 'degraded' ||
      !platformTruth.flags.workerRunning ||
      platformTruth.optionalSubsystemIssues.length > 0);

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="min-w-0 flex-1">
        {degraded && (
          <p className="truncate text-xs text-amber-800" role="status">
            Platform degraded
            {!platformTruth.flags.workerRunning && ' · Background jobs may not run'}
            {platformTruth.optionalSubsystemIssues.length > 0 && ' · Some integrations unavailable'}
            {canViewSystem && (
              <>
                {' · '}
                <Link href="/system" className="font-medium underline underline-offset-2">
                  System
                </Link>
              </>
            )}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className="text-sm text-slate-500">{user.name ?? user.email}</span>
        <form action={logoutAction}>
          <button type="submit" className="btn-ghost text-sm">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
