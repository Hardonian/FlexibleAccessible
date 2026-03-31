"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { ScanSiteActionState } from "./scan-action-state";

function SubmitLabel({ state }: { state: ScanSiteActionState }) {
  const { pending } = useFormStatus();
  if (pending) return "Queuing\u2026";
  if (state.status === "already_pending" || state.status === "already_running")
    return "Verification in progress";
  return "Queue verification scan";
}

export function ScanNowButton({
  action,
  initialState,
  disabled,
  blockedHint,
  siteId,
}: {
  action: (
    prev: ScanSiteActionState,
    formData: FormData,
  ) => Promise<ScanSiteActionState>;
  initialState: ScanSiteActionState;
  disabled: boolean;
  blockedHint?: string | null;
  siteId: string;
}) {
  const [state, formAction] = useFormState(action, initialState);
  const hint = state.message ?? blockedHint;
  const isError = state.variant === "error";

  return (
    <div className="space-y-1">
      <form action={formAction}>
        <input type="hidden" name="siteId" value={siteId} readOnly />
        <button
          type="submit"
          className="btn-secondary"
          disabled={disabled}
          aria-label={
            disabled
              ? (blockedHint ?? "Verification scan unavailable")
              : "Queue verification scan"
          }
        >
          <SubmitLabel state={state} />
        </button>
      </form>
      {hint ? (
        <p
          className={`text-xs ${isError ? "text-red-700" : "text-slate-600"}`}
          role={isError ? "alert" : undefined}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
