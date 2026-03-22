'use client';

import { useActionState } from 'react';
import { addSiteAction } from './actions';

export function AddSiteForm() {
  const [state, formAction, pending] = useActionState(addSiteAction, { error: null });

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {state.error}
        </div>
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
        />
        <p className="mt-1 text-xs text-slate-400">Include the protocol (https://)</p>
      </div>

      <div>
        <label htmlFor="sitemapUrl" className="label">
          Sitemap URL <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          id="sitemapUrl"
          name="sitemapUrl"
          type="url"
          className="input"
          placeholder="https://example.com/sitemap.xml"
        />
      </div>

      <div>
        <label htmlFor="environment" className="label">
          Environment
        </label>
        <select id="environment" name="environment" className="input">
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
          />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="label">Options</legend>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="respectRobots"
            defaultChecked
            className="rounded border-slate-300"
          />
          Respect robots.txt
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="renderJavaScript"
            defaultChecked
            className="rounded border-slate-300"
          />
          Render JavaScript (recommended for SPAs)
        </label>
      </fieldset>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <a href="/sites" className="btn-secondary">
          Cancel
        </a>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Adding site...' : 'Add Site & Start Crawl'}
        </button>
      </div>
    </form>
  );
}
