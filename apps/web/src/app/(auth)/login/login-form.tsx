"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, {
    error: null,
  });

  return (
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
    </form>
  );
}
