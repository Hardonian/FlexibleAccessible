import Link from 'next/link';
import { PRODUCT_DISPLAY_NAME } from '@/lib/product-brand';

export const metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[rgb(var(--color-canvas))] px-6 py-16 pb-[max(4rem,env(safe-area-inset-bottom))]">
      <div className="card max-w-md text-center">
        <h1 className="text-lg font-semibold text-slate-900">You are offline</h1>
        <p className="mt-2 text-sm text-slate-600">
          {PRODUCT_DISPLAY_NAME} needs a network connection for sign-in, scans, and live data. Cached pages may still open; try again when
          you are back online.
        </p>
        <p className="mt-4">
          <Link href="/" className="btn-primary inline-flex">
            Go to home
          </Link>
        </p>
      </div>
    </div>
  );
}
