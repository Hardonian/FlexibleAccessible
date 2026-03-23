import type { ReactNode } from 'react';
import Link from 'next/link';

type NoticeVariant = 'warning' | 'error' | 'info';

const variantClass: Record<NoticeVariant, string> = {
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  error: 'border-red-200 bg-red-50 text-red-950',
  info: 'border-slate-200 bg-slate-50 text-slate-900',
};

export function RouteReliabilityNotice({
  variant,
  title,
  children,
  showSystemLink = false,
}: {
  variant: NoticeVariant;
  title: string;
  children: ReactNode;
  showSystemLink?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 text-sm ${variantClass[variant]}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <p className="font-medium">{title}</p>
      <div className="mt-1">{children}</div>
      {showSystemLink && (
        <p className="mt-2">
          Operators:{' '}
          <Link href="/system" className="font-medium underline underline-offset-2">
            System &amp; core services
          </Link>
        </p>
      )}
    </div>
  );
}
