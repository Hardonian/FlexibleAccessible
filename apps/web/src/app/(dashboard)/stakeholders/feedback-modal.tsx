"use client";

import { useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import { submitStakeholderFeedbackAction } from "./actions";

interface FeedbackModalProps {
  stakeholders: Array<{ id: string; name: string }>;
}

export function FeedbackModal({ stakeholders }: FeedbackModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await submitStakeholderFeedbackAction(formData);

    setLoading(false);
    if (result.success) {
      setIsOpen(false);
    } else {
      setError(result.error ?? "Failed to log feedback.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn-secondary inline-flex items-center gap-2"
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
        Log Community Feedback
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-modal-title"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 id="feedback-modal-title" className="text-xl font-bold text-slate-900">
                  Record Accessibility Feedback
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Capture observations, barriers, or suggestions from end users and advocates.
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
              <div>
                <label htmlFor="fb-stakeholder" className="label">Stakeholder / Source</label>
                <select id="fb-stakeholder" name="stakeholderId" className="input">
                  <option value="">General Community Member</option>
                  {stakeholders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="fb-category" className="label">Category</label>
                  <select id="fb-category" name="category" defaultValue="BARRIER" className="input">
                    <option value="BARRIER">Barrier / Blocker</option>
                    <option value="SUGGESTION">Improvement Suggestion</option>
                    <option value="PRAISE">Positive Usability</option>
                    <option value="GENERAL">General Observation</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="fb-urgency" className="label">Priority</label>
                  <select id="fb-urgency" name="urgency" defaultValue="MEDIUM" className="input">
                    <option value="HIGH">High (Blocks Task)</option>
                    <option value="MEDIUM">Medium (Causes Friction)</option>
                    <option value="LOW">Low (Minor Polish)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="fb-url" className="label">Affected URL / Flow</label>
                <input
                  id="fb-url"
                  name="affectedUrl"
                  type="text"
                  placeholder="https://example.com/checkout"
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="fb-content" className="label">Feedback Content *</label>
                <textarea
                  id="fb-content"
                  name="content"
                  required
                  rows={4}
                  placeholder="Describe the user experience, assistive technology used, and defect observed..."
                  className="input text-xs leading-relaxed"
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
                  {loading ? "Recording..." : "Save Feedback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
