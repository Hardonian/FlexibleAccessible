"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "./actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, {
    error: null,
    submitted: false,
  });

  if (state.submitted) {
    return (
      <div
        role="status"
        className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-800"
      >
        If an account exists for that email, we sent password reset instructions.
        The link expires in one hour and works once.
      </div>
    );
  }

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
          Sending reset instructions…
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
          disabled={pending}
        />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full min-h-[44px]">
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
