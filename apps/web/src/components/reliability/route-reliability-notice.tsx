import type { ReactNode } from 'react';
import Link from 'next/link';

type NoticeVariant = 'warning' | 'error' | 'info' | 'success';

const variantConfig: Record<
  NoticeVariant,
  {
    wrapper: string;
    leftBorder: string;
    iconBg: string;
    icon: React.FC<{ className?: string; 'aria-hidden'?: boolean }>;
  }
> = {
  warning: {
    wrapper: 'border-amber-200 bg-amber-50 text-amber-950',
    leftBorder: 'border-l-amber-400',
    iconBg: 'text-amber-500',
    icon: ({ className, ...p }) => (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor" {...p}>
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  error: {
    wrapper: 'border-red-200 bg-red-50 text-red-950',
    leftBorder: 'border-l-red-400',
    iconBg: 'text-red-500',
    icon: ({ className, ...p }) => (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor" {...p}>
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  info: {
    wrapper: 'border-slate-200 bg-slate-50 text-slate-900',
    leftBorder: 'border-l-brand-400',
    iconBg: 'text-brand-500',
    icon: ({ className, ...p }) => (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor" {...p}>
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    leftBorder: 'border-l-emerald-400',
    iconBg: 'text-emerald-500',
    icon: ({ className, ...p }) => (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor" {...p}>
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
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
  const cfg = variantConfig[variant];
  const IconComponent = cfg.icon;

  return (
    <div
      className={`flex gap-3 rounded-lg border border-l-4 p-4 text-sm ${cfg.wrapper} ${cfg.leftBorder}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <IconComponent
        className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.iconBg}`}
        aria-hidden={true}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <div className="mt-1 leading-relaxed">{children}</div>
        {showSystemLink && (
          <p className="mt-2">
            Operators:{' '}
            <Link
              href="/system"
              className="font-medium underline underline-offset-2 hover:opacity-80"
            >
              System &amp; core services
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
