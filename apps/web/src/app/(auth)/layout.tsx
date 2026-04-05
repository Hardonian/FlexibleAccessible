import {
  PRODUCT_DISPLAY_NAME,
  PRODUCT_TAGLINE,
} from '@/lib/product-brand';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-canvas))] px-4">
      <a
        href="#auth-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:rounded focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        Skip to main content
      </a>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-brand-900">
            {PRODUCT_DISPLAY_NAME}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{PRODUCT_TAGLINE}</p>
          <p className="mx-auto mt-4 max-w-sm text-left text-xs text-slate-500">
            Private workspaces add monitored crawls, deduplicated findings,
            review queues, and exports—bounded public scans only sample a few
            pages.
          </p>
        </div>
        <main id="auth-content">{children}</main>
      </div>
    </div>
  );
}
