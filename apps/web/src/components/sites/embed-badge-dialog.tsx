"use client";

import { useState } from "react";
import { ShieldCheck, Copy, Check, ExternalLink, Code } from "lucide-react";

interface EmbedBadgeDialogProps {
  domain: string;
  siteName: string;
}

export function EmbedBadgeDialog({ domain, siteName }: EmbedBadgeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const badgeUrl = `https://aros.dev/api/badge?domain=${encodeURIComponent(cleanDomain)}`;
  const scanUrl = `https://aros.dev/scan/${encodeURIComponent(cleanDomain)}`;

  const markdownSnippet = `[![Accessibility Score](${badgeUrl})](${scanUrl})`;
  const htmlSnippet = `<a href="${scanUrl}" target="_blank" rel="noopener noreferrer"><img src="${badgeUrl}" alt="Accessibility Conformance Score" /></a>`;

  function copyText(text: string, type: string) {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn-secondary inline-flex items-center gap-1.5 text-xs min-h-[36px]"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
        Embed Compliance Badge
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="badge-modal-title"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 id="badge-modal-title" className="text-base font-bold text-slate-900">
                  Embeddable Accessibility Badge
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Display real-time verification and progress on your website footer or GitHub README.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {/* Badge Preview */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Live Badge Preview
                </p>
                <div className="inline-block p-2 rounded bg-white shadow-xs border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/badge?domain=${encodeURIComponent(cleanDomain)}`}
                    alt="AROS Accessibility Badge Preview"
                    className="h-6"
                  />
                </div>
              </div>

              {/* Markdown snippet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Markdown (for GitHub README & Docs)
                  </label>
                  <button
                    type="button"
                    onClick={() => copyText(markdownSnippet, "markdown")}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700"
                  >
                    {copiedType === "markdown" ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="rounded-lg bg-slate-900 p-3 text-[11px] text-slate-200 font-mono overflow-x-auto">
                  {markdownSnippet}
                </pre>
              </div>

              {/* HTML snippet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    HTML (for Web Footers & Portals)
                  </label>
                  <button
                    type="button"
                    onClick={() => copyText(htmlSnippet, "html")}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700"
                  >
                    {copiedType === "html" ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="rounded-lg bg-slate-900 p-3 text-[11px] text-slate-200 font-mono overflow-x-auto">
                  {htmlSnippet}
                </pre>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn-secondary text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
