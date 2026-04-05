"use client";

import { useActionState } from "react";
import Link from "next/link";
import { addSiteAction } from "./actions";

export function AddSiteForm() {
  const [state, formAction, pending] = useActionState(addSiteAction, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      {state.error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      {pending && (
        <p className="sr-only" role="status" aria-live="polite">
          Adding site and starting crawl, please wait...
        </p>
      )}

      <div>
        <label htmlFor="name" className="label">
          Site name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="input"
          placeholder="My Website"
          disabled={pending}
        />
      </div>

      <div>
        <label htmlFor="domain" className="label">
          Domain
        </label>
        <input
          id="domain"
          name="domain"
          type="url"
          required
          className="input"
          placeholder="https://example.com"
          disabled={pending}
        />
        <p className="mt-1 text-xs text-slate-500">
          Include the protocol (https://). We start a crawl as soon as the site
          is saved.
        </p>
      </div>

      <details className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-canvas))] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          Advanced crawl options
        </summary>
        <div className="mt-4 space-y-5 border-t border-[rgb(var(--color-border))] pt-4">
          <div>
            <label htmlFor="sitemapUrl" className="label">
              Sitemap URL{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="sitemapUrl"
              name="sitemapUrl"
              type="url"
              className="input"
              placeholder="https://example.com/sitemap.xml"
              disabled={pending}
            />
          </div>

          <div>
            <label htmlFor="environment" className="label">
              Environment
            </label>
            <select
              id="environment"
              name="environment"
              className="input"
              disabled={pending}
            >
              <option value="PRODUCTION">Production</option>
              <option value="STAGING">Staging</option>
              <option value="DEVELOPMENT">Development</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="maxDepth" className="label">
                Max crawl depth
              </label>
              <input
                id="maxDepth"
                name="maxDepth"
                type="number"
                min={1}
                max={20}
                defaultValue={5}
                className="input"
                disabled={pending}
              />
            </div>
            <div>
              <label htmlFor="maxPages" className="label">
                Max pages
              </label>
              <input
                id="maxPages"
                name="maxPages"
                type="number"
                min={1}
                max={10000}
                defaultValue={100}
                className="input"
                disabled={pending}
              />
            </div>
          </div>

          <fieldset className="space-y-3" disabled={pending}>
            <legend className="label">Options</legend>
            <label className="flex min-h-[44px] items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                name="respectRobots"
                defaultChecked
                className="h-4 w-4 shrink-0 rounded border-slate-300"
                disabled={pending}
              />
              Respect robots.txt
            </label>
            <label className="flex min-h-[44px] items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                name="renderJavaScript"
                defaultChecked
                className="h-4 w-4 shrink-0 rounded border-slate-300"
                disabled={pending}
              />
              Render JavaScript (recommended for SPAs)
            </label>
          </fieldset>
        </div>
      </details>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <Link href="/sites" className="btn-secondary min-h-[44px]">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary min-h-[44px]"
        >
          {pending ? "Adding site..." : "Add Site & Start Crawl"}
        </button>
      </div>
    </form>
  );
}
