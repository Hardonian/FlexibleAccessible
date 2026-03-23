import Link from 'next/link';
import type { RoutePlatformTruth } from '@aros/core-services';

const shellBlockerTitle: Record<RoutePlatformTruth['shellBlocker'], string> = {
  none: 'Platform notice',
  critical_dependency_down: 'Core service unavailable',
  install_required: 'Installation required',
  deployment_misconfigured: 'Deployment needs attention',
};

export function PlatformShellBanner({
  truth,
  audience,
  canViewSystem = false,
}: {
  truth: RoutePlatformTruth;
  audience: 'user' | 'operator';
  canViewSystem?: boolean;
}) {
  const hasUserLines = truth.userImpactSummary.length > 0;
  if (truth.shellBlocker === 'none' && !hasUserLines) {
    return null;
  }

  const isCritical = truth.shellBlocker === 'critical_dependency_down';
  const shellTitle = shellBlockerTitle[truth.shellBlocker];

  const userLines =
    truth.shellBlocker === 'none' ? truth.userImpactSummary : truth.userImpactSummary;

  const showOperatorDetail =
    audience === 'operator' && truth.operatorRemediationHints.length > 0;

  return (
    <div
      className={
        isCritical
          ? 'border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-950'
          : 'border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-950'
      }
      role={isCritical ? 'alert' : 'status'}
      aria-live={isCritical ? 'assertive' : 'polite'}
    >
      <p className="font-medium">{shellTitle}</p>
      {truth.shellBlocker !== 'none' && (
        <p className="mt-1 text-xs opacity-90">
          Platform readiness: <span className="font-mono">{truth.readiness}</span>
          {truth.installed ? '' : ' · Not installed'}
        </p>
      )}
      {userLines.length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-1">
          {userLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {showOperatorDetail && (
        <div className="mt-3 rounded border border-amber-300/60 bg-white/60 p-3 text-xs text-slate-800">
          <p className="font-medium text-slate-900">Operator notes</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {truth.operatorRemediationHints.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {canViewSystem && (
        <p className="mt-2">
          <Link href="/system" className="font-medium underline underline-offset-2">
            Open System &amp; core services
          </Link>{' '}
          for live checks and remediation steps.
        </p>
      )}
    </div>
  );
}
