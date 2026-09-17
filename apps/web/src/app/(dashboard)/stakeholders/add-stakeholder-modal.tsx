"use client";

import { useState } from "react";
import { Plus, X, UserPlus } from "lucide-react";
import { createStakeholderAction } from "./actions";

const SEGMENTS = [
  { value: "END_USERS_WITH_DISABILITIES", label: "End Users with Disabilities" },
  { value: "ACCESSIBILITY_CHAMPIONS", label: "Accessibility Champions" },
  { value: "EXECUTIVE_SPONSORS", label: "Executive Sponsors" },
  { value: "PRODUCT_ENGINEERING", label: "Product & Engineering" },
  { value: "LEGAL_COMPLIANCE", label: "Legal & Compliance" },
  { value: "EXTERNAL_ADVOCATES", label: "External Advocates & Regulators" },
];

const ACCESSIBILITY_NEEDS = [
  { value: "SCREEN_READER", label: "Screen Reader User" },
  { value: "KEYBOARD_ONLY", label: "Keyboard-Only Navigation" },
  { value: "LOW_VISION", label: "Low Vision / High Contrast" },
  { value: "COLOR_BLIND", label: "Color Vision Deficiency" },
  { value: "DEAF_HARD_OF_HEARING", label: "Deaf / Hard of Hearing" },
  { value: "COGNITIVE", label: "Cognitive / Neurodivergent" },
  { value: "MOTOR_DEXTERITY", label: "Motor / Dexterity Limitations" },
  { value: "SPEECH", label: "Speech Disability" },
];

const UNDERREPRESENTED_GROUPS = [
  { value: "ELDERLY_USERS", label: "Elderly Users (65+)" },
  { value: "NON_NATIVE_SPEAKERS", label: "Non-Native Speakers / ESL" },
  { value: "NEURODIVERGENT", label: "Neurodivergent Community" },
  { value: "LOW_BANDWIDTH", label: "Low-Bandwidth / Assistive Hardware" },
  { value: "RURAL_COMMUNITIES", label: "Rural / Low-Connectivity Users" },
];

export function AddStakeholderModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createStakeholderAction(formData);

    setLoading(false);
    if (result.success) {
      setIsOpen(false);
    } else {
      setError(result.error ?? "Failed to add stakeholder.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn-primary inline-flex items-center gap-2"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Add Stakeholder
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 id="modal-title" className="text-xl font-bold text-slate-900">
                  Register Accessibility Stakeholder
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track advocates, user testing participants, and cross-functional partners.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="st-name" className="label">Full Name *</label>
                  <input
                    id="st-name"
                    name="name"
                    type="text"
                    required
                    placeholder="e.g. Jordan Miller"
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="st-email" className="label">Email Address *</label>
                  <input
                    id="st-email"
                    name="email"
                    type="email"
                    required
                    placeholder="jordan@advocacy.org"
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="st-role" className="label">Role / Title</label>
                  <input
                    id="st-role"
                    name="role"
                    type="text"
                    placeholder="e.g. Assistive Tech Specialist"
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="st-segment" className="label">Stakeholder Segment</label>
                  <select id="st-segment" name="segment" className="input">
                    {SEGMENTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="st-power" className="label">Power / Influence</label>
                  <select id="st-power" name="power" defaultValue="MEDIUM" className="input">
                    <option value="HIGH">High (Decision Maker)</option>
                    <option value="MEDIUM">Medium (Contributor)</option>
                    <option value="LOW">Low (End Consumer)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="st-interest" className="label">Accessibility Interest</label>
                  <select id="st-interest" name="interest" defaultValue="HIGH" className="input">
                    <option value="HIGH">High (Deeply Engaged)</option>
                    <option value="MEDIUM">Medium (Periodic Updates)</option>
                    <option value="LOW">Low (Aware Only)</option>
                  </select>
                </div>
              </div>

              <fieldset className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                <legend className="text-xs font-semibold uppercase tracking-wider text-slate-600 px-1">
                  Accessibility Needs & Assistive Tech
                </legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ACCESSIBILITY_NEEDS.map((need) => (
                    <label key={need.value} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        name="accessibilityNeeds"
                        value={need.value}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      {need.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                <legend className="text-xs font-semibold uppercase tracking-wider text-slate-600 px-1">
                  Inclusivity & Underrepresented Communities
                </legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {UNDERREPRESENTED_GROUPS.map((group) => (
                    <label key={group.value} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        name="underrepresentedGroups"
                        value={group.value}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      {group.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="st-notes" className="label">Context & Background Notes</label>
                <textarea
                  id="st-notes"
                  name="notes"
                  rows={2}
                  placeholder="e.g. Conducts monthly NVDA & VoiceOver audits on checkout flow."
                  className="input text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? "Registering..." : "Save Stakeholder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
