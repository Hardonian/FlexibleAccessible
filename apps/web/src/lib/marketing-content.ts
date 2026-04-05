/**
 * Shared marketing copy and section data for the public home page and JSON-LD.
 * Keeps narrative consistent across structured data and on-page content.
 */
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";

export const developerFeatures = [
  "MCP server with a broad IDE tool surface (see package README for the current tool list)",
  "Scoped API keys with organization boundaries enforced server-side",
  "CLI for CI gates and diff-friendly scan output",
  "Webhooks when crawls complete—wire into your own runbooks",
  "Same engine as the product UI—no mystery “AI score” API",
] as const;

export const managedServices = [
  {
    title: "Program setup & playbooks",
    description:
      "Define scan scope, severity policy, export templates, and stakeholder reporting rhythms so the work stays accountable.",
  },
  {
    title: "Remediation partnership",
    description:
      "Engineers pair with your team on high-impact clusters—PRs, CMS patterns, and design-system fixes—not widget overlays.",
  },
  {
    title: "Ongoing operations",
    description:
      "Scheduled scans, regression alerts, and evidence packs for leadership—priced as a service, not shelf-ware.",
  },
] as const;

export const productFeatures = [
  {
    title: "Browser-accurate crawling",
    description:
      "Playwright renders like users’ browsers—CSR, SSR, and real accessibility trees—so findings match what ships.",
  },
  {
    title: "Clustered root causes",
    description:
      "Roll thousands of page hits into one component-level issue. Triage once, clear the blast radius with intent.",
  },
  {
    title: "Bounded assist, not autopilot",
    description:
      "Draft fixes with rationale and confidence where enabled. Nothing ships as “AI magic”—review and export are explicit gates.",
  },
  {
    title: "Fixes in your repo",
    description:
      "Map to source, open GitHub PRs, or export patches—so remediation lives in version control.",
  },
  {
    title: "Review & accountability",
    description:
      "Queues for what automation cannot judge: copy, context, keyboard flows, and assistive-tech nuance.",
  },
  {
    title: "Evidence for stakeholders",
    description:
      "Exports and report artifacts meant for agencies, execs, and procurement—not a single green score.",
  },
] as const;

export const homeFaqs = [
  {
    question: "How is this different from another “AI accessibility” checker?",
    answer:
      `${PRODUCT_DISPLAY_NAME} is built as an operations surface: browser-accurate crawling, clustered findings so you fix root causes, review queues, exports, and API/MCP hooks. Where AI appears, it is bounded—draft suggestions with confidence and human review—not a black-box compliance promise.`,
  },
  {
    question: "How is this different from accessibility overlays?",
    answer:
      "Overlays inject third-party widgets that do not repair underlying code and are widely rejected by the disability community. This product is source-first: fix HTML, CSS, ARIA, and components where they belong.",
  },
  {
    question: "Do you guarantee WCAG or legal compliance?",
    answer:
      "No. Automated testing covers a fraction of WCAG. We surface evidence and workflow state; manual testing by experts and users with disabilities remains essential for any serious conformance claim.",
  },
  {
    question: "What does the free instant scan include?",
    answer:
      "A bounded public sample of pages with clear limitations—enough to see signal, not a substitute for full-site monitoring, private workspaces, history, or exports. Upgrade for the complete operator workflow.",
  },
] as const;
