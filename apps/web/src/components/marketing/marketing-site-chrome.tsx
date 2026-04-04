import type { ReactNode } from "react";
import Link from "next/link";
import {
  PRODUCT_DISPLAY_NAME,
  PRODUCT_LEGAL_LINE,
  PRODUCT_TAGLINE,
} from "@/lib/product-brand";

export function MarketingSiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[rgb(var(--color-canvas))] text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        Skip to main content
      </a>

      <header className="border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))]/90 backdrop-blur-sm supports-[backdrop-filter]:bg-[rgb(var(--color-surface-elevated))]/80">
        <nav
          className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4"
          aria-label="Main"
        >
          <Link
            href="/"
            className="group flex flex-col leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded-md"
          >
            <span className="text-lg font-semibold tracking-tight text-brand-800">
              {PRODUCT_DISPLAY_NAME}
            </span>
            <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700">
              {PRODUCT_TAGLINE}
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/#proof" className="hover:text-slate-900">
              Proof &amp; workflow
            </Link>
            <Link href="/#pricing" className="hover:text-slate-900">
              Plans
            </Link>
            <Link href="/trust" className="hover:text-slate-900">
              Trust
            </Link>
            <Link href="/docs/api" className="hover:text-slate-900">
              Integrations
            </Link>
            <Link href="/login" className="hover:text-slate-900">
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary text-sm">
              Start workspace
            </Link>
          </div>
        </nav>
      </header>

      <main id="main">{children}</main>

      <footer className="border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))] py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {PRODUCT_DISPLAY_NAME}
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              {PRODUCT_LEGAL_LINE}
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-800">
              Home
            </Link>
            <Link href="/trust" className="hover:text-slate-800">
              Trust
            </Link>
            <Link href="/security" className="hover:text-slate-800">
              Security
            </Link>
            <Link href="/docs/api" className="hover:text-slate-800">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
