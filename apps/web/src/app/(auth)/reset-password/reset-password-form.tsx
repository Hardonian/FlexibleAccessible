"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, {
    error: null,
    token,
  });

  const effectiveToken = state.token || token;

  if (!effectiveToken) {
    return (
      <p role="alert" className="text-sm text-red-700">
        This reset link is invalid or has expired. Request a new link from the sign-in page.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4" aria-busy={pending}>
      <input type="hidden" name="token" value={effectiveToken} />
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
          Updating password…
        </p>
      )}
      <div>
        <label htmlFor="password" className="label">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
          disabled={pending}
        />
      </div>
      <div>
        <label htmlFor="confirm" className="label">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
          disabled={pending}
        />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full min-h-[44px]">
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
