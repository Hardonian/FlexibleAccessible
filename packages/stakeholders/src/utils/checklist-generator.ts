// ─── Checklist Generator ───────────────────────────────────────────────
// Generates ready-to-use checklists from gap analysis results

import type { GapAnalysisReport } from "./gap-analysis";

export interface ChecklistItem {
  category: string;
  item: string;
  checked: boolean;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  owner: string;
}

export interface Checklist {
  title: string;
  generatedAt: Date;
  categories: Record<string, ChecklistItem[]>;
  totalItems: number;
  criticalItems: number;
  markdown: string;
}

export function createChecklist(gapAnalysis: GapAnalysisReport): Checklist {
  const categories: Record<string, ChecklistItem[]> = {
    Identification: [],
    "Underrepresented Groups": [],
    "Needs & Expectations": [],
    "Power/Interest Mapping": [],
    "Risk & Bias": [],
    "Engagement Strategy": [],
    "Data & Validation": [],
    Governance: [],
    Metrics: [],
  };

  // Map gaps to checklist items
  for (const [dimension, gaps] of Object.entries(gapAnalysis.dimensions)) {
    const category = mapDimensionToCategory(dimension);
    for (const gap of gaps) {
      categories[category].push({
        category,
        item: gap.remedy,
        checked: false,
        priority: gap.priority,
        owner: gap.owner,
      });
    }
  }

  // Add standard checklist items
  addStandardItems(categories);

  // Generate markdown
  const markdown = generateMarkdown(categories);

  const allItems = Object.values(categories).flat();
  const totalItems = allItems.length;
  const criticalItems = allItems.filter(
    (i) => i.priority === "CRITICAL",
  ).length;

  return {
    title: "Stakeholder Analysis Checklist",
    generatedAt: new Date(),
    categories,
    totalItems,
    criticalItems,
    markdown,
  };
}

function mapDimensionToCategory(dimension: string): string {
  const mapping: Record<string, string> = {
    "Stakeholder Identification": "Identification",
    "Underrepresented Groups": "Underrepresented Groups",
    "Needs and Expectations": "Needs & Expectations",
    "Power/Interest Mapping": "Power/Interest Mapping",
    "Risk and Bias": "Risk & Bias",
    "Engagement and Communication": "Engagement Strategy",
    "Data Sources": "Data & Validation",
    "Validation Methods": "Data & Validation",
    "Goal Alignment": "Metrics",
  };
  return mapping[dimension] || "Engagement Strategy";
}

function addStandardItems(categories: Record<string, ChecklistItem[]>): void {
  // Standard items that should always be present
  const standard: Array<{
    category: string;
    item: string;
    priority: ChecklistItem["priority"];
    owner: string;
  }> = [
    // Identification
    {
      category: "Identification",
      item: "Stakeholder registry created and maintained",
      priority: "CRITICAL",
      owner: "PM",
    },
    {
      category: "Identification",
      item: "Primary/secondary/tertiary stakeholders mapped",
      priority: "HIGH",
      owner: "PM",
    },
    {
      category: "Identification",
      item: "Stakeholder lifecycle tracking implemented",
      priority: "MEDIUM",
      owner: "PM",
    },
    {
      category: "Identification",
      item: "Stakeholder interdependency mapping completed",
      priority: "MEDIUM",
      owner: "BA",
    },

    // Underrepresented Groups
    {
      category: "Underrepresented Groups",
      item: "Disability community representation verified",
      priority: "CRITICAL",
      owner: "A11y Lead",
    },
    {
      category: "Underrepresented Groups",
      item: "Intersectional analysis completed",
      priority: "HIGH",
      owner: "UX Research",
    },
    {
      category: "Underrepresented Groups",
      item: "International/local context included",
      priority: "HIGH",
      owner: "PM",
    },
    {
      category: "Underrepresented Groups",
      item: "Low-income/tech-constrained users considered",
      priority: "HIGH",
      owner: "Community Mgr",
    },
    {
      category: "Underrepresented Groups",
      item: "Aging population needs addressed",
      priority: "MEDIUM",
      owner: "UX Research",
    },

    // Needs & Expectations
    {
      category: "Needs & Expectations",
      item: "Structured needs assessment conducted",
      priority: "HIGH",
      owner: "UX Research",
    },
    {
      category: "Needs & Expectations",
      item: "Expectations quantified",
      priority: "MEDIUM",
      owner: "PM",
    },
    {
      category: "Needs & Expectations",
      item: "Needs vs. wants vs. solutions distinguished",
      priority: "MEDIUM",
      owner: "BA",
    },
    {
      category: "Needs & Expectations",
      item: "Needs mapped to WCAG/standards",
      priority: "HIGH",
      owner: "A11y Lead",
    },

    // Power/Interest Mapping
    {
      category: "Power/Interest Mapping",
      item: "Power/interest matrix created",
      priority: "HIGH",
      owner: "PM",
    },
    {
      category: "Power/Interest Mapping",
      item: "Champions identified",
      priority: "HIGH",
      owner: "PM",
    },
    {
      category: "Power/Interest Mapping",
      item: "Resistance anticipated",
      priority: "MEDIUM",
      owner: "PM",
    },
    {
      category: "Power/Interest Mapping",
      item: "Coalition building strategy defined",
      priority: "MEDIUM",
      owner: "PM",
    },

    // Risk & Bias
    {
      category: "Risk & Bias",
      item: "Bias self-audit completed",
      priority: "CRITICAL",
      owner: "A11y Lead",
    },
    {
      category: "Risk & Bias",
      item: "Confirmation bias mitigated (red team review)",
      priority: "HIGH",
      owner: "QA Lead",
    },
    {
      category: "Risk & Bias",
      item: "Technology bias addressed (analog alternatives)",
      priority: "MEDIUM",
      owner: "A11y Lead",
    },
    {
      category: "Risk & Bias",
      item: "Red team review conducted",
      priority: "HIGH",
      owner: "QA Lead",
    },

    // Engagement Strategy
    {
      category: "Engagement Strategy",
      item: "Communication channels accessible (WCAG AA)",
      priority: "CRITICAL",
      owner: "A11y Lead",
    },
    {
      category: "Engagement Strategy",
      item: "Feedback loops operational",
      priority: "HIGH",
      owner: "Product",
    },
    {
      category: "Engagement Strategy",
      item: "Escalation paths defined",
      priority: "HIGH",
      owner: "PM",
    },
    {
      category: "Engagement Strategy",
      item: "Relationship health tracked",
      priority: "MEDIUM",
      owner: "PM",
    },

    // Data & Validation
    {
      category: "Data & Validation",
      item: "Primary research conducted",
      priority: "HIGH",
      owner: "UX Research",
    },
    {
      category: "Data & Validation",
      item: "Triangulation methodology applied",
      priority: "MEDIUM",
      owner: "BA",
    },
    {
      category: "Data & Validation",
      item: "Continuous validation cadence set",
      priority: "MEDIUM",
      owner: "PM",
    },
    {
      category: "Data & Validation",
      item: "Accessibility-specific validation included",
      priority: "HIGH",
      owner: "A11y Lead",
    },

    // Governance
    {
      category: "Governance",
      item: "Council/stakeholder group formed",
      priority: "HIGH",
      owner: "Leadership",
    },
    {
      category: "Governance",
      item: "Ethical principles documented",
      priority: "HIGH",
      owner: "Leadership",
    },
    {
      category: "Governance",
      item: "Conflict resolution process defined",
      priority: "MEDIUM",
      owner: "PM",
    },

    // Metrics
    {
      category: "Metrics",
      item: "Engagement metrics defined",
      priority: "HIGH",
      owner: "PM",
    },
    {
      category: "Metrics",
      item: "Outcome metrics defined",
      priority: "HIGH",
      owner: "PM",
    },
    {
      category: "Metrics",
      item: "Baseline measurements taken",
      priority: "MEDIUM",
      owner: "PM",
    },
    {
      category: "Metrics",
      item: "Maturity assessment framework defined",
      priority: "MEDIUM",
      owner: "Strategy",
    },
  ];

  for (const item of standard) {
    const existing = categories[item.category]?.some(
      (i) => i.item.toLowerCase() === item.item.toLowerCase(),
    );
    if (!existing) {
      categories[item.category] = categories[item.category] || [];
      categories[item.category].push({
        category: item.category,
        item: item.item,
        checked: false,
        priority: item.priority,
        owner: item.owner,
      });
    }
  }
}

function generateMarkdown(categories: Record<string, ChecklistItem[]>): string {
  let md = "# Stakeholder Analysis Checklist\n\n";
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += "---\n\n";

  for (const [category, items] of Object.entries(categories)) {
    if (items.length === 0) continue;

    md += `## ${category}\n\n`;

    const critical = items.filter((i) => i.priority === "CRITICAL");
    const high = items.filter((i) => i.priority === "HIGH");
    const medium = items.filter((i) => i.priority === "MEDIUM");
    const low = items.filter((i) => i.priority === "LOW");

    for (const group of [critical, high, medium, low]) {
      for (const item of group) {
        md += `- [ ] **${item.priority}**: ${item.item} — *Owner: ${item.owner}*\n`;
      }
    }

    md += "\n";
  }

  md += "---\n\n";
  md +=
    "*For detailed gap analysis, see: stakeholder-analysis-gap-analysis.md*\n";

  return md;
}
