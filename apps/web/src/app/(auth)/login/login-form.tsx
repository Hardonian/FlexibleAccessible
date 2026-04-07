"use client";

import React, { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm({ ssoEnabled }: { ssoEnabled?: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, {
    error: null,
  });

  return (
    <div className="space-y-6">
      {ssoEnabled && (
        <div className="space-y-2">
          <a
            href="/api/auth/oidc/start?returnTo=%2Fdashboard"
            className="btn-secondary flex w-full min-h-[44px] items-center justify-center font-medium"
          >
            Continue with organization SSO
          </a>
          <p className="text-center text-xs text-slate-500">
            Uses OpenID Connect when enabled by your deployment operator.
          </p>
        </div>
      )}
      {ssoEnabled && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wide">
            <span className="bg-white px-2 text-slate-500">Or email</span>
          </div>
        </div>
      )}
    <form action={formAction} className="space-y-4" aria-busy={pending}>
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
          Signing in, please wait...
        </p>
      )}

      <div>
        <label htmlFor="email" className="label">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder="you@example.com"
          disabled={pending}
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input"
          placeholder="Enter your password"
          disabled={pending}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full min-h-[44px]"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-center text-sm">
        <a
          href="/forgot-password"
          className="text-brand-600 hover:text-brand-700 font-medium underline underline-offset-2"
        >
          Forgot password?
        </a>
      </p>
    </form>
    </div>
  );
}
