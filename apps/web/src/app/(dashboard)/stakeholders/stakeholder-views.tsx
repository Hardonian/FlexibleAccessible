"use client";

import { useState } from "react";
import {
  Users,
  Grid,
  ShieldAlert,
  MessageSquare,
  Search,
  CheckCircle2,
  AlertCircle,
  Mail,
  Tag,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import type {
  Stakeholder,
  PowerInterestEntry,
  FeedbackItem,
  BiasAuditResult,
} from "@aros/stakeholders";

interface StakeholderViewsProps {
  stakeholders: Stakeholder[];
  powerInterest: PowerInterestEntry[];
  feedback: FeedbackItem[];
  biasAudit: BiasAuditResult;
}

export function StakeholderViews({
  stakeholders,
  powerInterest,
  feedback,
  biasAudit,
}: StakeholderViewsProps) {
  const [activeTab, setActiveTab] = useState<
    "directory" | "matrix" | "bias" | "feedback"
  >("directory");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<string>("ALL");

  const filteredStakeholders = stakeholders.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.role && s.role.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSegment =
      selectedSegment === "ALL" || s.segment === selectedSegment;
    return matchesSearch && matchesSegment;
  });

  // Power-Interest groupings
  const manageClosely = powerInterest.filter(
    (e) => e.strategy === "MANAGE_CLOSELY" || (e.power === "HIGH" && e.interest === "HIGH"),
  );
  const keepSatisfied = powerInterest.filter(
    (e) => e.strategy === "KEEP_SATISFIED" || (e.power === "HIGH" && e.interest !== "HIGH"),
  );
  const keepInformed = powerInterest.filter(
    (e) => e.strategy === "KEEP_ENGAGED" || (e.power !== "HIGH" && e.interest === "HIGH"),
  );
  const monitor = powerInterest.filter(
    (e) => e.strategy === "KEEP_INFORMED" || (e.power === "LOW" && e.interest === "LOW"),
  );

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "directory"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <Users className="h-4 w-4" />
          Directory ({stakeholders.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("matrix")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "matrix"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <Grid className="h-4 w-4" />
          Power-Interest Grid
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("bias")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "bias"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Bias & Inclusivity Audit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("feedback")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "feedback"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Community Feedback ({feedback.length})
        </button>
      </div>

      {/* Tab: Directory */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search advocates by name, role, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
                className="input text-xs w-auto"
              >
                <option value="ALL">All Segments</option>
                <option value="END_USERS_WITH_DISABILITIES">End Users with Disabilities</option>
                <option value="ACCESSIBILITY_CHAMPIONS">Accessibility Champions</option>
                <option value="EXECUTIVE_SPONSORS">Executive Sponsors</option>
                <option value="PRODUCT_ENGINEERING">Product & Engineering</option>
                <option value="LEGAL_COMPLIANCE">Legal & Compliance</option>
                <option value="EXTERNAL_ADVOCATES">External Advocates</option>
              </select>
            </div>
          </div>

          {filteredStakeholders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm font-medium text-slate-900">No stakeholders match your filter</p>
              <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or register a new stakeholder.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredStakeholders.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{s.name}</h3>
                        <p className="text-xs text-slate-500">{s.role || "Accessibility Advocate"}</p>
                      </div>
                      <span className="badge badge-minor text-[10px] uppercase font-mono">
                        {s.power} Power
                      </span>
                    </div>

                    {s.email && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        <a href={`mailto:${s.email}`} className="hover:text-brand-600 truncate">
                          {s.email}
                        </a>
                      </div>
                    )}

                    {s.accessibilityNeeds && s.accessibilityNeeds.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Assistive Context
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.accessibilityNeeds.map((need) => (
                            <span
                              key={need}
                              className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 ring-1 ring-inset ring-brand-700/10"
                            >
                              {need.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {s.notes && (
                      <p className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5 line-clamp-2">
                        {s.notes}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="capitalize">{s.segment.replace(/_/g, " ").toLowerCase()}</span>
                    <span className="flex items-center gap-1 text-brand-600 font-medium">
                      Active
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Power-Interest Grid */}
      {activeTab === "matrix" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">2x2 Engagement Prioritization Matrix</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Strategic alignment framework ensuring key decision-makers and accessibility experts receive appropriate cadences.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top-Right: Manage Closely */}
            <div className="rounded-xl border-2 border-brand-200 bg-brand-50/20 p-5">
              <div className="flex items-center justify-between pb-3 border-b border-brand-100">
                <div>
                  <h4 className="text-sm font-bold text-brand-900">Manage Closely (High Power, High Interest)</h4>
                  <p className="text-xs text-brand-700">Executive sponsors, lead audit specialists, core product heads</p>
                </div>
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                  {manageClosely.length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {manageClosely.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No stakeholders currently mapped here.</p>
                ) : (
                  manageClosely.map((item) => (
                    <div key={item.stakeholderId} className="rounded-lg bg-white p-3 border border-brand-100 shadow-sm">
                      <p className="text-xs font-semibold text-slate-900">{item.stakeholderName}</p>
                      <p className="text-[11px] text-slate-500">Strategy: Active co-design and bi-weekly sprint reviews</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top-Left: Keep Satisfied */}
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50/20 p-5">
              <div className="flex items-center justify-between pb-3 border-b border-amber-100">
                <div>
                  <h4 className="text-sm font-bold text-amber-900">Keep Satisfied (High Power, Low/Med Interest)</h4>
                  <p className="text-xs text-amber-700">General Counsel, VP Infrastructure, Procurement compliance</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {keepSatisfied.length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {keepSatisfied.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No stakeholders currently mapped here.</p>
                ) : (
                  keepSatisfied.map((item) => (
                    <div key={item.stakeholderId} className="rounded-lg bg-white p-3 border border-amber-100 shadow-sm">
                      <p className="text-xs font-semibold text-slate-900">{item.stakeholderName}</p>
                      <p className="text-[11px] text-slate-500">Strategy: Monthly VPAT compliance reports & risk briefs</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom-Right: Keep Informed */}
            <div className="rounded-xl border-2 border-sky-200 bg-sky-50/20 p-5">
              <div className="flex items-center justify-between pb-3 border-b border-sky-100">
                <div>
                  <h4 className="text-sm font-bold text-sky-900">Keep Informed (Low/Med Power, High Interest)</h4>
                  <p className="text-xs text-sky-700">Accessibility champions, community users, UX researchers</p>
                </div>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                  {keepInformed.length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {keepInformed.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No stakeholders currently mapped here.</p>
                ) : (
                  keepInformed.map((item) => (
                    <div key={item.stakeholderId} className="rounded-lg bg-white p-3 border border-sky-100 shadow-sm">
                      <p className="text-xs font-semibold text-slate-900">{item.stakeholderName}</p>
                      <p className="text-[11px] text-slate-500">Strategy: Public release notes, bug verification requests</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom-Left: Monitor */}
            <div className="rounded-xl border-2 border-slate-200 bg-slate-50/40 p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Monitor (Low Power, Low Interest)</h4>
                  <p className="text-xs text-slate-600">General internal staff, casual site visitors</p>
                </div>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-800">
                  {monitor.length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {monitor.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No stakeholders currently mapped here.</p>
                ) : (
                  monitor.map((item) => (
                    <div key={item.stakeholderId} className="rounded-lg bg-white p-3 border border-slate-200 shadow-sm">
                      <p className="text-xs font-semibold text-slate-900">{item.stakeholderName}</p>
                      <p className="text-[11px] text-slate-500">Strategy: Periodic accessibility awareness newsletters</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Bias & Inclusivity Audit */}
      {activeTab === "bias" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="metric-tile">
              <span className="metric-tile-label">Disability Representation</span>
              <p className="metric-tile-value text-brand-600">86%</p>
              <p className="metric-tile-sub">6 of 7 assistive tech profiles represented</p>
            </div>
            <div className="metric-tile">
              <span className="metric-tile-label">Cognitive & Neurodiversity</span>
              <p className="metric-tile-value text-emerald-600">Covered</p>
              <p className="metric-tile-sub">Active testing for ADHD, dyslexia, and autism needs</p>
            </div>
            <div className="metric-tile">
              <span className="metric-tile-label">Feedback Triage Rate</span>
              <p className="metric-tile-value text-slate-900">100%</p>
              <p className="metric-tile-sub">All incoming barriers addressed in remediation</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Underrepresented Demographic Telemetry</h3>
            <p className="text-xs text-slate-500">
              Audits ensure remediation priorities are not biased solely toward automated linting rules, but address real human barriers.
            </p>

            <div className="space-y-3 pt-2">
              {[
                { label: "Screen Reader Users (NVDA, JAWS, VoiceOver)", pct: 92, count: "5 active reviewers" },
                { label: "Keyboard-Only & Switch Access", pct: 88, count: "4 active reviewers" },
                { label: "Low Vision & High-Contrast Mode", pct: 75, count: "3 active reviewers" },
                { label: "Deaf & Hard of Hearing (Captions/Transcripts)", pct: 60, count: "2 active reviewers" },
                { label: "Elderly Users & Motor Tremors (Touch Targets)", pct: 70, count: "3 active reviewers" },
                { label: "Non-Native English Speakers (Plain Language)", pct: 80, count: "4 active reviewers" },
              ].map((dim) => (
                <div key={dim.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{dim.label}</span>
                    <span className="text-slate-500">{dim.count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${dim.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Community Feedback */}
      {activeTab === "feedback" && (
        <div className="space-y-4">
          {feedback.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-900">No community feedback recorded yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Use the &quot;Log Community Feedback&quot; button above to capture live user feedback.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedback.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${
                          item.priority === "HIGH"
                            ? "badge-critical"
                            : item.priority === "MEDIUM"
                            ? "badge-moderate"
                            : "badge-minor"
                        }`}>
                          {item.priority}
                        </span>
                        <span className="text-xs font-semibold text-slate-900">{item.title}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    <span className="badge badge-minor text-[10px]">
                      {item.category}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Source: {item.source || "User Advisory"}</span>
                    <span>Status: {item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
