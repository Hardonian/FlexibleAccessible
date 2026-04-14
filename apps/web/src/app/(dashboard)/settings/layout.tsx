import type { ReactNode } from "react";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/settings", label: "General", exact: true },
  { href: "/settings/members", label: "Members" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/api-keys", label: "API keys" },
  { href: "/settings/identity", label: "Identity & access" },
] as const;

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <nav aria-label="Settings navigation">
        <ul className="flex flex-wrap gap-1 border-b border-slate-200 pb-0" role="list">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-t-lg border border-transparent px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 aria-[current=page]:border-slate-200 aria-[current=page]:border-b-white aria-[current=page]:bg-white aria-[current=page]:text-slate-900 -mb-px"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div>{children}</div>
    </div>
  );
}
