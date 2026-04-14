import Link from "next/link";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[rgb(var(--color-canvas))] px-6 text-center">
      <div className="mx-auto max-w-md">
        {/* Shield mark with 404 */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 ring-1 ring-slate-200">
          <svg viewBox="0 0 28 28" fill="none" className="h-11 w-11 text-slate-400" aria-hidden="true">
            <path
              d="M14 2.5L4 7v7c0 5.5 4.3 10.7 10 12 5.7-1.3 10-6.5 10-12V7L14 2.5z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M11 11h6M14 11v6"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          This URL doesn't exist in {PRODUCT_DISPLAY_NAME}. If you followed a link from inside the app, please report it.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="btn-primary">
            Go to dashboard
          </Link>
          <Link href="/" className="btn-secondary">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
