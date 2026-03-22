import { clsx } from 'clsx';

interface SeverityBadgeProps {
  severity: 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR';
}

const styles = {
  CRITICAL: 'bg-red-100 text-red-800',
  SERIOUS: 'bg-orange-100 text-orange-800',
  MODERATE: 'bg-amber-100 text-amber-800',
  MINOR: 'bg-green-100 text-green-800',
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[severity]
      )}
    >
      {severity.toLowerCase()}
    </span>
  );
}
