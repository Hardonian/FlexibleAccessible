"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { FindingCopilotDrawer } from "./finding-copilot-drawer";

interface FindingActionToolbarProps {
  findingId: string;
  organizationId: string;
  ruleId: string;
}

export function FindingActionToolbar({
  findingId,
  organizationId,
  ruleId,
}: FindingActionToolbarProps) {
  const [copilotOpen, setCopilotOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setCopilotOpen(true)}
        className="btn-primary inline-flex items-center gap-2 bg-gradient-to-r from-brand-600 to-teal-700 hover:from-brand-700 hover:to-teal-800 text-white shadow-sm"
      >
        <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
        Ask AI Copilot
      </button>

      <FindingCopilotDrawer
        findingId={findingId}
        organizationId={organizationId}
        ruleId={ruleId}
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
      />
    </>
  );
}
