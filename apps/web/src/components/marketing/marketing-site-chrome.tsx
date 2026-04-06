import type { ReactNode } from "react";
import Link from "next/link";
import {
  PRODUCT_CONTACT_EMAIL,
  PRODUCT_DISPLAY_NAME,
  PRODUCT_LEGAL_LINE,
} from "@/lib/product-brand";
import { MarketingSiteHeader } from "./marketing-site-header";

export function MarketingSiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[rgb(var(--color-canvas))] text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        Skip to main content
      </a>

      <MarketingSiteHeader />

      <main id="main">{children}</main>

      <footer className="border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))] py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {PRODUCT_DISPLAY_NAME}
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              {PRODUCT_LEGAL_LINE} Managed services and procurement:{" "}
              <a
                className="font-medium text-brand-800 hover:underline"
                href={`mailto:${PRODUCT_CONTACT_EMAIL}`}
              >
                {PRODUCT_CONTACT_EMAIL}
              </a>
              .
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
            <Link href="/privacy" className="hover:text-slate-800">
              Privacy
            </Link>
            <Link href="/support" className="hover:text-slate-800">
              Support
            </Link>
            <Link href="/docs/api" className="hover:text-slate-800">
              Docs
            </Link>
            <Link href="/legal/terms" className="hover:text-slate-800">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
