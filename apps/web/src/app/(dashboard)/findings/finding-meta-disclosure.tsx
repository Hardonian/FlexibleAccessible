"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function FindingMetaDisclosure({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <details className="group border-t border-slate-100 -mx-6 mt-0 px-6 pb-4 pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-slate-600 select-none hover:text-slate-900 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          aria-hidden="true"
        />
        Technical details
      </summary>
      <div className="mt-3 text-sm text-slate-600">{children}</div>
    </details>
  );
}
