"use client";

import { useActionState } from "react";
import { resendVerificationAction } from "./actions";

export function ResendVerificationForm() {
  const [state, formAction, pending] = useActionState(resendVerificationAction, {
    error: null,
    ok: false,
  });

  return (
    <form action={formAction} className="space-y-3">
      {state.error && (
        <div role="alert" className="text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-emerald-800">
          If email is configured, we sent a new confirmation link.
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-secondary min-h-[44px]">
        {pending ? "Sending…" : "Resend confirmation email"}
      </button>
    </form>
  );
}
