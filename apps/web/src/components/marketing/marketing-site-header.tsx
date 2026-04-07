"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PRODUCT_DISPLAY_NAME, PRODUCT_TAGLINE } from "@/lib/product-brand";
import { PRIMARY_MARKETING_NAV } from "@/lib/marketing-routes";

const NAV_LINKS = [
  { href: "/#proof", label: "Proof & workflow" },
  { href: "/#pricing", label: "Plans" },
  ...PRIMARY_MARKETING_NAV,
  { href: "/login", label: "Sign in" },
] as const;

export function MarketingSiteHeader() {
  const [open, setOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    const triggerEl = closeBtnRef.current;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => firstLinkRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      triggerEl?.focus();
    };
  }, [open]);

  return (
    <header className="border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))]/90 backdrop-blur-sm supports-[backdrop-filter]:bg-[rgb(var(--color-surface-elevated))]/80">
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4"
        aria-label="Main"
      >
        <Link
          href="/"
          className="group flex min-w-0 flex-col leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded-md"
        >
          <span className="text-lg font-semibold tracking-tight text-brand-800">
            {PRODUCT_DISPLAY_NAME}
          </span>
          <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700">
            {PRODUCT_TAGLINE}
          </span>
        </Link>

        <div className="hidden items-center gap-8 sm:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/signup" className="btn-primary">
            Start workspace
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            ref={closeBtnRef}
            className="btn-secondary min-h-[44px] px-3 text-sm"
            aria-expanded={open}
            aria-controls="marketing-nav-menu"
            onClick={() => setOpen(true)}
          >
            Menu
          </button>
          <Link href="/signup" className="btn-primary min-h-[44px] px-3 text-sm">
            Start
          </Link>
        </div>
      </nav>

      {open ? (
        <div
          className="fixed inset-0 z-50 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            id="marketing-nav-menu"
            className="absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-l border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))] shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[rgb(var(--color-border))] px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">Menu</span>
              <button
                type="button"
                className="btn-ghost min-h-[44px] px-3 text-sm"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <ul className="flex flex-col gap-1 p-3" role="list">
              {NAV_LINKS.map((l, i) => (
                <li key={l.href}>
                  <Link
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={l.href}
                    className="block rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    onClick={() => setOpen(false)}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="pt-2">
                <Link
                  href="/signup"
                  className="btn-primary block w-full text-center"
                  onClick={() => setOpen(false)}
                >
                  Start workspace
                </Link>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </header>
  );
}
