"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Layers,
  Sparkles,
  FileCheck,
  Users,
  ChevronRight,
  ChevronLeft,
  X,
  HelpCircle,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

interface TrainingStep {
  title: string;
  subtitle: string;
  badge: string;
  icon: typeof ShieldCheck;
  highlight: string;
  content: string[];
  actionLabel: string;
  actionHref: string;
}

const TRAINING_STEPS: TrainingStep[] = [
  {
    title: "1. Evidence-Grade Diagnostics (No Fake Overlays)",
    subtitle: "Real source-level auditing powered by Headless Chromium & Axe-Core",
    badge: "Core Engine",
    icon: ShieldCheck,
    highlight: "Never settle for JavaScript widget overlays. In 2024–2025, over 800 lawsuits targeted overlay sites. AROS audits the real rendered DOM tree.",
    content: [
      "Every crawl runs headless Chromium with Playwright, evaluating real computed styles, accessibility trees, and ARIA attributes.",
      "Defects are cryptographically fingerprinted by DOM selector, rule ID, and HTML snippet to track issues across code releases.",
      "Produces deterministic evidence that legal teams, auditors, and engineering leaders can verify with zero ambiguity.",
    ],
    actionLabel: "Try Instant Public Scan",
    actionHref: "/scan/aros.dev",
  },
  {
    title: "2. The 80/20 Pareto Leverage Curve",
    subtitle: "Fix 80% of accessibility violations by patching 2–3 component templates",
    badge: "Time Saver",
    icon: Layers,
    highlight: "Don't manually fix 500 individual page errors. Our clustering engine groups issues by shared component origins.",
    content: [
      "Most accessibility errors stem from design system primitives: modal focus traps, mobile menu buttons, or missing form labels.",
      "The Pareto Impact model automatically identifies the top 20% of defect clusters that resolve 80% of your total site violations.",
      "Calculates estimated engineering hours saved and direct ROI on development time.",
    ],
    actionLabel: "View Pareto Clusters",
    actionHref: "/clusters",
  },
  {
    title: "3. AI Copilot & Verified GitHub PRs",
    subtitle: "Automated, secure code remedies with AST and script injection validation",
    badge: "Developer Workflow",
    icon: Sparkles,
    highlight: "Raw LLM output never touches your repository. Every proposed fix undergoes deterministic schema validation before a PR is opened.",
    content: [
      "AI Copilot supports streaming 'Expert' and 'Teach' modes on every finding detail view.",
      "The validator strips event handlers, evaluates AST safety, and checks rule-specific recipe criteria.",
      "Direct GitHub repository integration opens clean, review-ready Pull Requests directly in your engineering workflow.",
    ],
    actionLabel: "Explore Findings Triage",
    actionHref: "/findings",
  },
  {
    title: "4. Self-Serve VPAT 2.5 Compliance Exports",
    subtitle: "Instant enterprise compliance matrices in HTML, Markdown, CSV, and JSON",
    badge: "Enterprise Ready",
    icon: FileCheck,
    highlight: "Stop paying $35,000 for static PDF audit reports that become obsolete the next time you push code.",
    content: [
      "Interactive VPAT 2.5 matrix dynamically maps current scan findings to WCAG 2.2 Level A and AA success criteria.",
      "Provides live conformance scorecards: Supports, Partially Supports, Does Not Support, or Not Applicable.",
      "One-click multi-format downloads tailored for enterprise procurement RFPs and legal compliance archives.",
    ],
    actionLabel: "Open VPAT Reports Hub",
    actionHref: "/reports",
  },
  {
    title: "5. Stakeholder Governance & Bias Tracking",
    subtitle: "Coordinate executives, developer champions, and disabled user feedback",
    badge: "Governance",
    icon: Users,
    highlight: "Accessibility is a human journey. Manage stakeholder relationships and prevent algorithmic bias automatically.",
    content: [
      "Live Power/Interest matrix categorizes stakeholders into Manage Closely, Keep Satisfied, Keep Engaged, and Keep Informed.",
      "Integrated feedback logging allows user testing findings from people with disabilities to influence engineering priorities.",
      "Algorithmic bias tracking flags systemic blind spots and monitors underrepresented disability category coverage.",
    ],
    actionLabel: "Open Stakeholders Hub",
    actionHref: "/stakeholders",
  },
];

export function PlatformTrainingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === "Escape") {
        setIsOpen(false);
      } else if (e.key === "ArrowRight") {
        setCurrentStep((prev) => Math.min(prev + 1, TRAINING_STEPS.length - 1));
      } else if (e.key === "ArrowLeft") {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const step = TRAINING_STEPS[currentStep];
  const StepIcon = step.icon;

  const handleNext = useCallback(() => {
    if (currentStep < TRAINING_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsOpen(false);
    }
  }, [currentStep]);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/80 px-2.5 py-1.5 text-xs font-semibold text-brand-900 transition-colors hover:bg-brand-100 hover:text-brand-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        title="Open interactive platform training and feature tour"
        aria-label="Platform Training and Quick Tour"
      >
        <HelpCircle className="h-4 w-4 text-brand-700" aria-hidden="true" />
        <span className="hidden sm:inline">Platform Tour</span>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="training-modal-title"
        >
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
                  <StepIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
                    {step.badge} • Step {currentStep + 1} of {TRAINING_STEPS.length}
                  </span>
                  <h2 id="training-modal-title" className="text-base font-bold text-slate-900">
                    {step.title}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                aria-label="Close training modal"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm font-medium text-slate-600">{step.subtitle}</p>

              {/* Callout Highlight */}
              <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3.5 text-xs text-brand-950">
                <p className="font-semibold">{step.highlight}</p>
              </div>

              {/* Key Bullet Points */}
              <ul className="space-y-2 text-xs text-slate-700">
                {step.content.map((point, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Modal Step Navigation Bar */}
            <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {TRAINING_STEPS.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setCurrentStep(index)}
                      className={`h-2 rounded-full transition-all ${
                        index === currentStep
                          ? "w-6 bg-brand-600"
                          : "w-2 bg-slate-300 hover:bg-slate-400"
                      }`}
                      aria-label={`Jump to step ${index + 1}`}
                    />
                  ))}
                </div>

                <Link
                  href={step.actionHref as any}
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 hover:underline"
                >
                  {step.actionLabel}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 bg-white">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  currentStep === 0
                    ? "cursor-not-allowed text-slate-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                {currentStep === TRAINING_STEPS.length - 1 ? (
                  "Finish Tour"
                ) : (
                  <>
                    Next Step
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
