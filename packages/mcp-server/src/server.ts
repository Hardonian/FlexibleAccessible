import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { prisma } from "@aros/db";
import { generateFix, validateFix } from "@aros/remediation";
import { logToolCall, checkMcpQuota } from "./billing";

export class ArosMcpServer {
  private server: McpServer;
  private orgId: string = "";
  private apiKeyId: string = "";

  constructor() {
    this.server = new McpServer({
      name: "aros",
      version: "0.1.0",
    });
    this.registerTools();
  }

  private async preflight(
    _scope: string,
  ): Promise<{ allowed: boolean; error?: string }> {
    const quota = await checkMcpQuota(this.orgId);
    if (!quota.allowed) return { allowed: false, error: quota.reason };
    return { allowed: true };
  }

  private async trackCall(
    toolName: string,
    inputTokens: number,
    startTime: number,
    success: boolean,
    error?: string,
  ) {
    const durationMs = Date.now() - startTime;
    await logToolCall({
      organizationId: this.orgId,
      apiKeyId: this.apiKeyId,
      toolName,
      inputTokens,
      outputTokens: 0,
      durationMs,
      success,
      errorMessage: error,
    }).catch(() => {});
  }

  private registerTools() {
    // ─── SITES ─────────────────────────────────────────────────────

    this.server.tool(
      "aros.list_sites",
      "List all monitored websites",
      { organizationId: z.string().describe("Organization ID") },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const organizationId = args.organizationId as string;
        this.orgId = organizationId;
        const pre = await this.preflight("sites:read");
        if (!pre.allowed)
          return { content: [{ type: "text" as const, text: pre.error! }] };

        const sites = await prisma.site.findMany({
          where: { workspace: { organizationId } },
          select: {
            id: true,
            name: true,
            domain: true,
            verified: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        });

        await this.trackCall("aros.list_sites", 100, start, true);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(sites, null, 2) },
          ],
        };
      },
    );

    this.server.tool(
      "aros.get_site",
      "Get details for a specific site",
      { organizationId: z.string(), siteId: z.string() },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const organizationId = args.organizationId as string;
        const siteId = args.siteId as string;
        this.orgId = organizationId;

        const site = await prisma.site.findFirst({
          where: { id: siteId, workspace: { organizationId } },
          include: {
            crawlConfig: true,
            _count: { select: { pages: true, canonicalFindings: true } },
          },
        });

        if (!site)
          return {
            content: [{ type: "text" as const, text: "Site not found" }],
          };
        await this.trackCall("aros.get_site", 200, start, true);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(site, null, 2) },
          ],
        };
      },
    );

    // ─── SCANNING & CRAWLING ──────────────────────────────────────

    this.server.tool(
      "aros.start_scan",
      "Start an accessibility scan for a site",
      { organizationId: z.string(), siteId: z.string() },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const organizationId = args.organizationId as string;
        const siteId = args.siteId as string;
        this.orgId = organizationId;
        const pre = await this.preflight("scan:write");
        if (!pre.allowed)
          return { content: [{ type: "text" as const, text: pre.error! }] };

        const site = await prisma.site.findFirst({
          where: { id: siteId, workspace: { organizationId } },
        });
        if (!site)
          return {
            content: [{ type: "text" as const, text: "Site not found" }],
          };

        const scanRun = await prisma.scanRun.create({
          data: { siteId, status: "PENDING" },
        });
        const { getSharedScanQueue } = await import("@aros/shared");
        const queue = getSharedScanQueue();
        await queue.add("scan", { scanRunId: scanRun.id, siteId });

        await this.trackCall("aros.start_scan", 500, start, true);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                scanRunId: scanRun.id,
                status: "PENDING",
              }),
            },
          ],
        };
      },
    );

    this.server.tool(
      "aros.get_scan_status",
      "Get the status of a scan run",
      { organizationId: z.string(), scanRunId: z.string() },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const organizationId = args.organizationId as string;
        const scanRunId = args.scanRunId as string;
        this.orgId = organizationId;

        const scanRun = await prisma.scanRun.findUnique({
          where: { id: scanRunId },
          select: {
            id: true,
            status: true,
            totalPages: true,
            pagesScanned: true,
            violationsFound: true,
            startedAt: true,
            completedAt: true,
            errorMessage: true,
          },
        });

        if (!scanRun)
          return {
            content: [{ type: "text" as const, text: "Scan not found" }],
          };
        await this.trackCall("aros.get_scan_status", 150, start, true);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(scanRun, null, 2) },
          ],
        };
      },
    );

    this.server.tool(
      "aros.start_crawl",
      "Start crawling a site to discover pages",
      { organizationId: z.string(), siteId: z.string() },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const organizationId = args.organizationId as string;
        const siteId = args.siteId as string;
        this.orgId = organizationId;
        const pre = await this.preflight("crawl:write");
        if (!pre.allowed)
          return { content: [{ type: "text" as const, text: pre.error! }] };

        const site = await prisma.site.findFirst({
          where: { id: siteId, workspace: { organizationId } },
        });
        if (!site)
          return {
            content: [{ type: "text" as const, text: "Site not found" }],
          };

        const crawlRun = await prisma.crawlRun.create({
          data: { siteId, status: "PENDING" },
        });
        const { bullmqConnectionOptions } = await import("@aros/shared");
        const { Queue } = await import("bullmq");
        const crawlQueue = new Queue("crawl", {
          connection: bullmqConnectionOptions(),
        });
        await crawlQueue.add("crawl", { crawlRunId: crawlRun.id, siteId });

        await this.trackCall("aros.start_crawl", 500, start, true);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                crawlRunId: crawlRun.id,
                status: "PENDING",
              }),
            },
          ],
        };
      },
    );

    // ─── FINDINGS ─────────────────────────────────────────────────

    this.server.tool(
      "aros.list_findings",
      "List accessibility findings for a site",
      {
        organizationId: z.string(),
        siteId: z.string(),
        status: z
          .enum([
            "OPEN",
            "ACKNOWLEDGED",
            "IN_PROGRESS",
            "RESOLVED",
            "MITIGATED",
            "FALSE_POSITIVE",
            "WONT_FIX",
          ])
          .optional(),
        impact: z.enum(["CRITICAL", "SERIOUS", "MODERATE", "MINOR"]).optional(),
        limit: z.number().default(50),
      },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const { organizationId, siteId, status, impact, limit } = args as {
          organizationId: string;
          siteId: string;
          status?: string;
          impact?: string;
          limit: number;
        };
        this.orgId = organizationId;

        const findings = await prisma.canonicalFinding.findMany({
          where: {
            siteId,
            site: { workspace: { organizationId } },
            ...(status ? { status: status as any } : {}),
            ...(impact ? { impact: impact as any } : {}),
          },
          select: {
            id: true,
            ruleId: true,
            impact: true,
            description: true,
            status: true,
            occurrenceCount: true,
            fingerprint: true,
            lastSeenAt: true,
            clusterId: true,
          },
          orderBy: [
            { impact: "asc" as const },
            { occurrenceCount: "desc" as const },
          ],
          take: limit,
        });

        await this.trackCall("aros.list_findings", 300, start, true);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(findings, null, 2) },
          ],
        };
      },
    );

    this.server.tool(
      "aros.get_finding",
      "Get details for a specific finding including occurrences",
      { organizationId: z.string(), findingId: z.string() },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const { organizationId, findingId } = args as {
          organizationId: string;
          findingId: string;
        };
        this.orgId = organizationId;

        const finding = await prisma.canonicalFinding.findFirst({
          where: { id: findingId, site: { workspace: { organizationId } } },
          include: {
            occurrences: {
              take: 10,
              include: { page: { select: { url: true } } },
            },
            suggestions: { take: 5, orderBy: { createdAt: "desc" as const } },
          },
        });

        if (!finding)
          return {
            content: [{ type: "text" as const, text: "Finding not found" }],
          };
        await this.trackCall("aros.get_finding", 500, start, true);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(finding, null, 2) },
          ],
        };
      },
    );

    // ─── REMEDIATION (AI-POWERED) ─────────────────────────────────

    this.server.tool(
      "aros.generate_fix",
      "Generate an AI remediation suggestion for a finding",
      { organizationId: z.string(), findingId: z.string() },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const { organizationId, findingId } = args as {
          organizationId: string;
          findingId: string;
        };
        this.orgId = organizationId;
        const pre = await this.preflight("remediation:write");
        if (!pre.allowed)
          return { content: [{ type: "text" as const, text: pre.error! }] };

        const finding = await prisma.canonicalFinding.findFirst({
          where: { id: findingId, site: { workspace: { organizationId } } },
          include: {
            occurrences: {
              take: 1,
              include: { page: { select: { url: true } } },
            },
          },
        });

        if (!finding)
          return {
            content: [{ type: "text" as const, text: "Finding not found" }],
          };
        const occ = finding.occurrences[0];
        if (!occ)
          return {
            content: [{ type: "text" as const, text: "No occurrences found" }],
          };

        const fix = generateFix({
          ruleId: finding.ruleId,
          elementHtml: occ.elementHtml,
          selector: occ.selector ?? "",
        });
        if (!fix)
          return {
            content: [
              { type: "text" as const, text: "Could not generate fix" },
            ],
          };

        const validation = validateFix(fix.suggestedCode);
        const suggestion = await prisma.remediationSuggestion.create({
          data: {
            canonicalFindingId: findingId,
            type: fix.type as any,
            status: validation.valid ? "VALIDATED" : "FAILED_VALIDATION",
            originalCode: occ.elementHtml,
            suggestedCode: fix.suggestedCode,
            rationale: fix.rationale,
            confidence: fix.confidence,
            validationResult: validation as any,
          },
        });

        await this.trackCall("aros.generate_fix", 2000, start, true);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(suggestion, null, 2),
            },
          ],
        };
      },
    );

    this.server.tool(
      "aros.batch_generate_fixes",
      "Generate fixes for all open findings in a site",
      {
        organizationId: z.string(),
        siteId: z.string(),
        limit: z.number().default(10),
      },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const { organizationId, siteId, limit } = args as {
          organizationId: string;
          siteId: string;
          limit: number;
        };
        this.orgId = organizationId;
        const pre = await this.preflight("remediation:write");
        if (!pre.allowed)
          return { content: [{ type: "text" as const, text: pre.error! }] };

        const findings = await prisma.canonicalFinding.findMany({
          where: {
            siteId,
            status: "OPEN",
            site: { workspace: { organizationId } },
          },
          include: { occurrences: { take: 1 } },
          take: limit,
        });

        const results: Array<{
          findingId: string;
          suggestionId: string;
          status: string;
          confidence: number;
        }> = [];
        for (const finding of findings) {
          const occ = finding.occurrences[0];
          if (!occ) continue;
          const fix = generateFix({
            ruleId: finding.ruleId,
            elementHtml: occ.elementHtml,
            selector: occ.selector ?? "",
          });
          if (fix) {
            const validation = validateFix(fix.suggestedCode);
            const suggestion = await prisma.remediationSuggestion.create({
              data: {
                canonicalFindingId: finding.id,
                type: fix.type as any,
                status: validation.valid ? "VALIDATED" : "FAILED_VALIDATION",
                originalCode: occ.elementHtml,
                suggestedCode: fix.suggestedCode,
                rationale: fix.rationale,
                confidence: fix.confidence,
                validationResult: validation as any,
              },
            });
            results.push({
              findingId: finding.id,
              suggestionId: suggestion.id,
              status: suggestion.status,
              confidence: fix.confidence,
            });
          }
        }

        await this.trackCall("aros.batch_generate_fixes", 5000, start, true);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { generated: results.length, results },
                null,
                2,
              ),
            },
          ],
        };
      },
    );

    this.server.tool(
      "aros.approve_suggestion",
      "Approve a remediation suggestion for export",
      { organizationId: z.string(), suggestionId: z.string() },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const { organizationId, suggestionId } = args as {
          organizationId: string;
          suggestionId: string;
        };
        this.orgId = organizationId;

        const suggestion = await prisma.remediationSuggestion.findFirst({
          where: { id: suggestionId, canonicalFindingId: { not: undefined } },
        });
        if (!suggestion)
          return {
            content: [{ type: "text" as const, text: "Suggestion not found" }],
          };

        const updated = await prisma.remediationSuggestion.update({
          where: { id: suggestionId },
          data: { status: "APPROVED" },
        });

        await this.trackCall("aros.approve_suggestion", 300, start, true);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ id: updated.id, status: updated.status }),
            },
          ],
        };
      },
    );

    this.server.tool(
      "aros.reject_suggestion",
      "Reject a remediation suggestion",
      {
        organizationId: z.string(),
        suggestionId: z.string(),
        reason: z.string().optional(),
      },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const { organizationId, suggestionId, reason } = args as {
          organizationId: string;
          suggestionId: string;
          reason?: string;
        };
        this.orgId = organizationId;

        const suggestion = await prisma.remediationSuggestion.findUnique({
          where: { id: suggestionId },
        });
        if (!suggestion)
          return {
            content: [{ type: "text" as const, text: "Suggestion not found" }],
          };

        const updated = await prisma.remediationSuggestion.update({
          where: { id: suggestionId },
          data: {
            status: "REJECTED",
            rationale: reason ? `Rejected: ${reason}` : suggestion.rationale,
          },
        });

        await this.trackCall("aros.reject_suggestion", 300, start, true);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ id: updated.id, status: updated.status }),
            },
          ],
        };
      },
    );

    // ─── CLUSTERS ─────────────────────────────────────────────────

    this.server.tool(
      "aros.list_clusters",
      "List issue clusters (component-level groupings)",
      { organizationId: z.string(), siteId: z.string() },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const { organizationId, siteId } = args as {
          organizationId: string;
          siteId: string;
        };
        this.orgId = organizationId;

        const clusters = await prisma.issueCluster.findMany({
          where: { siteId, site: { workspace: { organizationId } } },
          select: {
            id: true,
            name: true,
            severity: true,
            pageCount: true,
            findingCount: true,
            selectorPattern: true,
            componentSignature: true,
          },
          orderBy: { pageCount: "desc" as const },
        });

        await this.trackCall("aros.list_clusters", 200, start, true);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(clusters, null, 2) },
          ],
        };
      },
    );

    this.server.tool(
      "aros.get_cluster",
      "Get cluster details including all member findings",
      { organizationId: z.string(), clusterId: z.string() },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const { organizationId, clusterId } = args as {
          organizationId: string;
          clusterId: string;
        };
        this.orgId = organizationId;

        const cluster = await prisma.issueCluster.findFirst({
          where: { id: clusterId, site: { workspace: { organizationId } } },
          include: {
            findings: {
              select: {
                id: true,
                ruleId: true,
                impact: true,
                description: true,
                status: true,
                occurrenceCount: true,
              },
            },
            suggestions: { take: 5, orderBy: { createdAt: "desc" as const } },
          },
        });

        if (!cluster)
          return {
            content: [{ type: "text" as const, text: "Cluster not found" }],
          };
        await this.trackCall("aros.get_cluster", 400, start, true);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(cluster, null, 2) },
          ],
        };
      },
    );

    // ─── SUGGESTIONS ──────────────────────────────────────────────

    this.server.tool(
      "aros.list_suggestions",
      "List remediation suggestions",
      {
        organizationId: z.string(),
        siteId: z.string().optional(),
        status: z
          .enum([
            "DRAFT",
            "VALIDATED",
            "FAILED_VALIDATION",
            "APPROVED",
            "EXPORTED",
            "APPLIED",
            "REJECTED",
          ])
          .optional(),
        limit: z.number().default(50),
      },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const { organizationId, siteId, status, limit } = args as {
          organizationId: string;
          siteId?: string;
          status?: string;
          limit: number;
        };
        this.orgId = organizationId;

        const suggestions = await prisma.remediationSuggestion.findMany({
          where: {
            ...(status ? { status: status as any } : {}),
            ...(siteId ? { canonicalFinding: { siteId } } : {}),
          },
          select: {
            id: true,
            type: true,
            status: true,
            confidence: true,
            rationale: true,
            canonicalFindingId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" as const },
          take: limit,
        });

        await this.trackCall("aros.list_suggestions", 300, start, true);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(suggestions, null, 2),
            },
          ],
        };
      },
    );

    // ─── EXPORTS ──────────────────────────────────────────────────

    this.server.tool(
      "aros.export_findings",
      "Export findings as JSON or CSV",
      {
        organizationId: z.string(),
        siteId: z.string(),
        format: z.enum(["json", "csv"]).default("json"),
        status: z.string().optional(),
      },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const { organizationId, siteId, format } = args as {
          organizationId: string;
          siteId: string;
          format: string;
        };
        this.orgId = organizationId;

        const findings = await prisma.canonicalFinding.findMany({
          where: { siteId, site: { workspace: { organizationId } } },
          include: {
            occurrences: {
              take: 1,
              include: { page: { select: { url: true } } },
            },
          },
          orderBy: [{ impact: "asc" as const }],
        });

        const exportData = findings.map((f) => ({
          id: f.id,
          ruleId: f.ruleId,
          impact: f.impact,
          description: f.description,
          status: f.status,
          occurrences: f.occurrenceCount,
          sampleUrl: f.occurrences[0]?.page?.url ?? "",
          sampleSelector: f.occurrences[0]?.selector ?? "",
        }));

        if (format === "csv") {
          const headers = [
            "ID",
            "Rule",
            "Impact",
            "Status",
            "Description",
            "Occurrences",
            "Sample URL",
            "Sample Selector",
          ];
          const rows = exportData.map((d) =>
            [
              d.id,
              d.ruleId,
              d.impact,
              d.status,
              `"${d.description.replace(/"/g, '""')}"`,
              d.occurrences,
              d.sampleUrl,
              d.sampleSelector,
            ].join(","),
          );
          await this.trackCall("aros.export_findings", 1000, start, true);
          return {
            content: [
              {
                type: "text" as const,
                text: [headers.join(","), ...rows].join("\n"),
              },
            ],
          };
        }

        await this.trackCall("aros.export_findings", 1000, start, true);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(exportData, null, 2),
            },
          ],
        };
      },
    );

    this.server.tool(
      "aros.get_conformance_report",
      "Generate a conformance report with evidence",
      { organizationId: z.string(), siteId: z.string() },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const { organizationId, siteId } = args as {
          organizationId: string;
          siteId: string;
        };
        this.orgId = organizationId;
        const pre = await this.preflight("reports:read");
        if (!pre.allowed)
          return { content: [{ type: "text" as const, text: pre.error! }] };

        const findings = await prisma.canonicalFinding.findMany({
          where: { siteId, site: { workspace: { organizationId } } },
          select: {
            ruleId: true,
            impact: true,
            status: true,
            wcagTags: true,
            occurrenceCount: true,
          },
        });

        const total = findings.length;
        const open = findings.filter(
          (f) => f.status === "OPEN" || f.status === "IN_PROGRESS",
        ).length;
        const resolved = findings.filter((f) =>
          ["RESOLVED", "MITIGATED", "FALSE_POSITIVE", "WONT_FIX"].includes(
            f.status,
          ),
        ).length;
        const byImpact = {
          CRITICAL: findings.filter((f) => f.impact === "CRITICAL").length,
          SERIOUS: findings.filter((f) => f.impact === "SERIOUS").length,
          MODERATE: findings.filter((f) => f.impact === "MODERATE").length,
          MINOR: findings.filter((f) => f.impact === "MINOR").length,
        };

        const scanRuns = await prisma.scanRun.findMany({
          where: { siteId },
          orderBy: { createdAt: "desc" as const },
          take: 5,
          select: {
            id: true,
            status: true,
            violationsFound: true,
            pagesScanned: true,
            completedAt: true,
          },
        });

        const report = {
          generatedAt: new Date().toISOString(),
          summary: { total, open, resolved, byImpact },
          resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
          recentScans: scanRuns,
          disclaimer:
            "Automated scanning detects approximately 30-40% of WCAG criteria. This report does not constitute legal compliance certification.",
        };

        await this.trackCall("aros.get_conformance_report", 1500, start, true);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(report, null, 2) },
          ],
        };
      },
    );

    // ─── WCAG KNOWLEDGE ──────────────────────────────────────────

    this.server.tool(
      "aros.get_wcag_criterion",
      "Get WCAG criterion details and techniques",
      { criterionId: z.string().describe('WCAG criterion ID, e.g. "1.1.1"') },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const criterionId = args.criterionId as string;

        const { wcagCriteriaMap } = await import("@aros/shared");
        const normalized = criterionId.replace(/[^a-z0-9]/gi, "").toLowerCase();
        const criterion = wcagCriteriaMap[`wcag${normalized}`];

        if (!criterion) {
          return {
            content: [
              {
                type: "text" as const,
                text: `WCAG criterion ${criterionId} not found. Full criteria at https://www.w3.org/WAI/WCAG22/Understanding/`,
              },
            ],
          };
        }

        await this.trackCall("aros.get_wcag_criterion", 100, start, true);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(criterion, null, 2) },
          ],
        };
      },
    );

    // ─── USAGE & BILLING ──────────────────────────────────────────

    this.server.tool(
      "aros.get_usage",
      "Get MCP API usage stats for billing",
      { organizationId: z.string(), days: z.number().default(30) },
      async (args: Record<string, unknown>) => {
        const start = Date.now();
        const { organizationId, days } = args as {
          organizationId: string;
          days: number;
        };
        this.orgId = organizationId;

        const { getUsageStats } = await import("./billing");
        const stats = await getUsageStats(organizationId, days);

        await this.trackCall("aros.get_usage", 200, start, true);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(stats, null, 2) },
          ],
        };
      },
    );
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("[AROS MCP] Server started on stdio");
  }
}
