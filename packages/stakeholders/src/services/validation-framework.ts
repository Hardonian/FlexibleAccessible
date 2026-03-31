// ─── Validation Framework ──────────────────────────────────────────────
// Triangulation methodology, continuous validation, and benchmarking
// Fills gap: No stakeholder validation process, no triangulation, no external benchmarking

import type {
  ValidationRecord,
  ValidationMethod,
  ValidationOutcome,
  TriangulationSource,
  TriangulationResult,
} from "../types/validation";
import { VALIDATION_METHODS, VALIDATION_OUTCOMES } from "../types/validation";

const records = new Map<string, ValidationRecord>();
const sources = new Map<string, TriangulationSource>();
let nextId = 1;

function generateId(prefix: string): string {
  return `${prefix}-${String(nextId++).padStart(4, "0")}`;
}

export class ValidationFramework {
  // ── Validation Record Management ─────────────────────────────────────

  async createRecord(input: {
    method: ValidationMethod;
    target: string;
    outcome: ValidationOutcome;
    findings?: string[];
    recommendations?: string[];
    evidence?: string[];
    owner: string;
    validatedAt: Date;
    nextValidation?: Date;
  }): Promise<ValidationRecord> {
    const id = generateId("val");
    const now = new Date();

    const record: ValidationRecord = {
      id,
      method: input.method,
      target: input.target,
      outcome: input.outcome,
      findings: input.findings ?? [],
      recommendations: input.recommendations ?? [],
      evidence: input.evidence ?? [],
      owner: input.owner,
      validatedAt: input.validatedAt,
      nextValidation: input.nextValidation,
      createdAt: now,
      updatedAt: now,
    };

    records.set(id, record);
    return record;
  }

  async getRecord(id: string): Promise<ValidationRecord | null> {
    return records.get(id) ?? null;
  }

  async listByTarget(target: string): Promise<ValidationRecord[]> {
    return Array.from(records.values()).filter((r) => r.target === target);
  }

  async listByMethod(method: ValidationMethod): Promise<ValidationRecord[]> {
    return Array.from(records.values()).filter((r) => r.method === method);
  }

  async listByOutcome(outcome: ValidationOutcome): Promise<ValidationRecord[]> {
    return Array.from(records.values()).filter((r) => r.outcome === outcome);
  }

  // ── Triangulation ────────────────────────────────────────────────────

  async addSource(source: {
    name: string;
    type: "PRIMARY" | "SECONDARY" | "EXTERNAL";
    reliability: "HIGH" | "MEDIUM" | "LOW";
  }): Promise<TriangulationSource> {
    const id = generateId("src");
    const record: TriangulationSource = {
      id,
      name: source.name,
      type: source.type,
      reliability: source.reliability,
      lastAccessed: new Date(),
    };
    sources.set(id, record);
    return record;
  }

  async triangulate(
    target: string,
    sourceIds: string[],
    findings: string[],
  ): Promise<TriangulationResult> {
    const usedSources: TriangulationSource[] = [];
    for (const id of sourceIds) {
      const source = sources.get(id);
      if (source) {
        source.lastAccessed = new Date();
        usedSources.push(source);
      }
    }

    // Analyze findings for agreements and contradictions
    // This is a simplified analysis — in production, use NLP or manual review
    const agreements: string[] = [];
    const contradictions: string[] = [];
    const gaps: string[] = [];

    // Group findings by source
    const bySource = new Map<string, string[]>();
    for (let i = 0; i < findings.length; i++) {
      const sourceId =
        sourceIds[
          Math.floor(i / Math.ceil(findings.length / sourceIds.length))
        ];
      const list = bySource.get(sourceId) || [];
      list.push(findings[i]);
      bySource.set(sourceId, list);
    }

    // Simple keyword matching for agreement detection
    for (let i = 0; i < findings.length; i++) {
      for (let j = i + 1; j < findings.length; j++) {
        const words1 = new Set(findings[i].toLowerCase().split(/\s+/));
        const words2 = new Set(findings[j].toLowerCase().split(/\s+/));
        const intersection = [...words1].filter(
          (w) => words2.has(w) && w.length > 4,
        );
        const overlap =
          intersection.length / Math.min(words1.size, words2.size);

        if (overlap > 0.3) {
          agreements.push(
            `Strong overlap between: "${findings[i].slice(0, 50)}..." and "${findings[j].slice(0, 50)}..."`,
          );
        } else if (overlap < 0.05) {
          contradictions.push(
            `Potential contradiction between: "${findings[i].slice(0, 50)}..." and "${findings[j].slice(0, 50)}..."`,
          );
        }
      }
    }

    // Identify gaps based on source types
    const hasPrimary = usedSources.some((s) => s.type === "PRIMARY");
    const hasSecondary = usedSources.some((s) => s.type === "SECONDARY");
    const hasExternal = usedSources.some((s) => s.type === "EXTERNAL");

    if (!hasPrimary)
      gaps.push("Missing primary research data (interviews, surveys)");
    if (!hasSecondary)
      gaps.push("Missing secondary data (analytics, existing reports)");
    if (!hasExternal)
      gaps.push("Missing external validation (benchmarks, peer comparison)");

    // Compute confidence level
    const reliabilityScore = usedSources.reduce((sum, s) => {
      const score = { HIGH: 3, MEDIUM: 2, LOW: 1 }[s.reliability];
      return sum + score;
    }, 0);
    const maxScore = usedSources.length * 3;
    const confidenceRatio = maxScore > 0 ? reliabilityScore / maxScore : 0;

    let confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
    if (confidenceRatio >= 0.75 && usedSources.length >= 3) {
      confidenceLevel = "HIGH";
    } else if (confidenceRatio >= 0.5 && usedSources.length >= 2) {
      confidenceLevel = "MEDIUM";
    } else {
      confidenceLevel = "LOW";
    }

    const conclusion = this.generateConclusion(
      target,
      agreements,
      contradictions,
      confidenceLevel,
    );
    const recommendations = this.generateRecommendations(
      gaps,
      confidenceLevel,
      usedSources.length,
    );

    return {
      target,
      sources: usedSources,
      agreements,
      contradictions,
      gaps,
      confidenceLevel,
      conclusion,
      recommendations,
      conductedAt: new Date(),
    };
  }

  private generateConclusion(
    target: string,
    agreements: string[],
    contradictions: string[],
    confidence: "HIGH" | "MEDIUM" | "LOW",
  ): string {
    if (confidence === "HIGH" && contradictions.length === 0) {
      return `High confidence validation for "${target}": Multiple sources agree with no contradictions detected.`;
    }
    if (confidence === "HIGH" && contradictions.length > 0) {
      return `High confidence with contradictions for "${target}": Strong agreement but ${contradictions.length} contradictions require investigation.`;
    }
    if (confidence === "MEDIUM") {
      return `Medium confidence validation for "${target}": Some agreement but gaps in data exist. Additional sources recommended.`;
    }
    return `Low confidence validation for "${target}": Insufficient sources. More data collection needed before conclusions.`;
  }

  private generateRecommendations(
    gaps: string[],
    confidence: "HIGH" | "MEDIUM" | "LOW",
    sourceCount: number,
  ): string[] {
    const recommendations: string[] = [];

    if (confidence === "LOW") {
      recommendations.push(
        "Collect additional data sources before making decisions",
      );
    }

    for (const gap of gaps) {
      recommendations.push(`Address: ${gap}`);
    }

    if (sourceCount < 3) {
      recommendations.push(
        "Add more sources for stronger triangulation (minimum 3 recommended)",
      );
    }

    recommendations.push("Schedule follow-up validation in 30-60 days");
    recommendations.push("Document all assumptions and track against outcomes");

    return recommendations;
  }

  // ── Validation Schedule ──────────────────────────────────────────────

  async getDueValidations(): Promise<ValidationRecord[]> {
    const now = new Date();
    return Array.from(records.values()).filter(
      (r) => r.nextValidation && r.nextValidation <= now,
    );
  }

  async getUpcomingValidations(days: number): Promise<ValidationRecord[]> {
    const deadline = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return Array.from(records.values()).filter(
      (r) => r.nextValidation && r.nextValidation <= deadline,
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────

  async getValidationSummary(): Promise<{
    totalValidations: number;
    byMethod: Record<ValidationMethod, number>;
    byOutcome: Record<ValidationOutcome, number>;
    passRate: number;
    dueCount: number;
    averageFindingsPerValidation: number;
  }> {
    const all = Array.from(records.values());

    const byMethod = Object.fromEntries(
      VALIDATION_METHODS.map((m) => [m, 0]),
    ) as Record<ValidationMethod, number>;

    const byOutcome = Object.fromEntries(
      VALIDATION_OUTCOMES.map((o) => [o, 0]),
    ) as Record<ValidationOutcome, number>;

    let totalFindings = 0;

    for (const record of all) {
      byMethod[record.method]++;
      byOutcome[record.outcome]++;
      totalFindings += record.findings.length;
    }

    const passed = byOutcome["PASSED"] || 0;
    const due = (await this.getDueValidations()).length;

    return {
      totalValidations: all.length,
      byMethod,
      byOutcome,
      passRate: all.length > 0 ? Math.round((passed / all.length) * 100) : 0,
      dueCount: due,
      averageFindingsPerValidation:
        all.length > 0 ? Math.round((totalFindings / all.length) * 10) / 10 : 0,
    };
  }

  // ── Export ────────────────────────────────────────────────────────────

  async exportAllRecords(): Promise<ValidationRecord[]> {
    return Array.from(records.values());
  }

  async exportAllSources(): Promise<TriangulationSource[]> {
    return Array.from(sources.values());
  }

  async clear(): Promise<void> {
    records.clear();
    sources.clear();
    nextId = 1;
  }
}
