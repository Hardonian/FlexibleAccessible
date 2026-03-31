import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { prisma } from "@aros/db";
import { generateFix, validateFix } from "@aros/remediation";
import { validateApiKey, hasScope, checkRateLimit } from "./auth";
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
    scope: string,
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
    // ═══════════════════════════════════════════════════════════════
    // SITES
    // ═══════════════════════════════════════════════════════════════

    this.server.tool(
      "aros.list_sites",
      "List all monitored websites",
      {
        organizationId: z.string().describe("Organization ID"),
      },
      async ({ organizationId }) => {
        const start = Date.now();
        this.orgId = organizationId;
        const pre = await this.preflight("sites:read");
        if (!pre.allowed)
          return { content: [{ type: "text", text: pre.error! }] };

        const sites = await prisma.site.findMany({
          where: { workspace: { organizationId } },
          select: {
            id: true,
            name: true,
            url: true,
            status: true,
            lastScanAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        });

        await this.trackCall("aros.list_sites", 100, start, true);
        return {
          content: [{ type: "text", text: JSON.stringify(sites, null, 2) }],
        };
      },
    );

    this.server.tool(
      "aros.get_site",
      "Get details for a specific site",
      {
        organizationId: z.string(),
        siteId: z.string(),
      },
      async ({ organizationId, siteId }) => {
        const start = Date.now();
        this.orgId = organizationId;

        const site = await prisma.site.findFirst({
          where: { id: siteId, workspace: { organizationId } },
          include: {
            crawlConfigs: true,
            _count: { select: { pages: true, canonicalFindings: true } },
          },
        });

        if (!site)
          return { content: [{ type: "text", text: "Site not found" }] };

        await this.trackCall("aros.get_site", 200, start, true);
        return {
          content: [{ type: "text", text: JSON.stringify(site, null, 2) }],
        };
      },
    );

    // ═══════════════════════════════════════════════════════════════
    // SCANNING & CRAWLING
    // ═══════════════════════════════════════════════════════════════

    this.server.tool(
      "aros.start_scan",
      "Start an accessibility scan for a site",
      {
        organizationId: z.string(),
        siteId: z.string(),
      },
      async ({ organizationId, siteId }) => {
        const start = Date.now();
        this.orgId = organizationId;
        const pre = await this.preflight("scan:write");
        if (!pre.allowed)
          return { content: [{ type: "text", text: pre.error! }] };

        const site = await prisma.site.findFirst({
          where: { id: siteId, workspace: { organizationId } },
        });
        if (!site)
          return { content: [{ type: "text", text: "Site not found" }] };

        const scanRun = await prisma.scanRun.create({
          data: { siteId, status: "QUEUED" },
        });

        const { getSharedScanQueue } = await import("@aros/shared");
        const queue = getSharedScanQueue();
        await queue.add("scan", { scanRunId: scanRun.id, siteId });

        await this.trackCall("aros.start_scan", 500, start, true);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ scanRunId: scanRun.id, status: "QUEUED" }),
            },
          ],
        };
      },
    );

    this.server.tool(
      "aros.get_scan_status",
      "Get the status of a scan run",
      {
        organizationId: z.string(),
        scanRunId: z.string(),
      },
      async ({ organizationId, scanRunId }) => {
        const start = Date.now();
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
          return { content: [{ type: "text", text: "Scan not found" }] };

        await this.trackCall("aros.get_scan_status", 150, start, true);
        return {
          content: [{ type: "text", text: JSON.stringify(scanRun, null, 2) }],
        };
      },
    );

    this.server.tool(
      "aros.start_crawl",
      "Start crawling a site to discover pages",
      {
        organizationId: z.string(),
        siteId: z.string(),
      },
      async ({ organizationId, siteId }) => {
        const start = Date.now();
        this.orgId = organizationId;
        const pre = await this.preflight("crawl:write");
        if (!pre.allowed)
          return { content: [{ type: "text", text: pre.error! }] };

        const site = await prisma.site.findFirst({
          where: { id: siteId, workspace: { organizationId } },
        });
        if (!site)
          return { content: [{ type: "text", text: "Site not found" }] };

        const crawlRun = await prisma.crawlRun.create({
          data: { siteId, status: "QUEUED" },
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
              type: "text",
              text: JSON.stringify({
                crawlRunId: crawlRun.id,
                status: "QUEUED",
              }),
            },
          ],
        };
      },
    );

    // ═══════════════════════════════════════════════════════════════
    // FINDINGS
    // ═══════════════════════════════════════════════════════════════

    this.server.tool(
      "aros.list_findings",
      "List accessibility findings for a site",
      {
        organizationId: z.string(),
        siteId: z.string(),
        status: z
          .enum([
            "OPEN",
            "IN_PROGRESS",
            "RESOLVED",
            "MITIGATED",
            "FALSE_POSITIVE",
            "WONT_FIX",
            "DEFERRED",
          ])
          .optional(),
        impact: z.enum(["CRITICAL", "SERIOUS", "MODERATE", "MINOR"]).optional(),
        limit: z.number().default(50),
      },
      async ({ organizationId, siteId, status, impact, limit }) => {
        const start = Date.now();
        this.orgId = organizationId;

        const findings = await prisma.canonicalFinding.findMany({
          where: {
            siteId,
            site: { workspace: { organizationId } },
            ...(status ? { status } : {}),
            ...(impact ? { impact } : {}),
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
          orderBy: [{ impact: "asc" }, { occurrenceCount: "desc" }],
          take: limit,
        });

        await this.trackCall("aros.list_findings", 300, start, true);
        return {
          content: [{ type: "text", text: JSON.stringify(findings, null, 2) }],
        };
      },
    );

    this.server.tool(
      "aros.get_finding",
      "Get details for a specific finding including occurrences",
      {
        organizationId: z.string(),
        findingId: z.string(),
      },
      async ({ organizationId, findingId }) => {
        const start = Date.now();
        this.orgId = organizationId;

        const finding = await prisma.canonicalFinding.findFirst({
          where: { id: findingId, site: { workspace: { organizationId } } },
          include: {
            occurrences: {
              take: 10,
              include: { page: { select: { url: true } } },
            },
            remediationSuggestions: { take: 5, orderBy: { createdAt: "desc" } },
          },
        });

        if (!finding)
          return { content: [{ type: "text", text: "Finding not found" }] };

        await this.trackCall("aros.get_finding", 500, start, true);
        return {
          content: [{ type: "text", text: JSON.stringify(finding, null, 2) }],
        };
      },
    );

    // ═══════════════════════════════════════════════════════════════
    // REMEDIATION (AI-POWERED — HIGHEST VALUE)
    // ═══════════════════════════════════════════════════════════════

    this.server.tool(
      "aros.generate_fix",
      "Generate an AI remediation suggestion for a finding",
      {
        organizationId: z.string(),
        findingId: z.string(),
      },
      async ({ organizationId, findingId }) => {
        const start = Date.now();
        this.orgId = organizationId;
        const pre = await this.preflight("remediation:write");
        if (!pre.allowed)
          return { content: [{ type: "text", text: pre.error! }] };

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
          return { content: [{ type: "text", text: "Finding not found" }] };

        const occ = finding.occurrences[0];
        if (!occ)
          return { content: [{ type: "text", text: "No occurrences found" }] };

        const fix = generateFix({
          ruleId: finding.ruleId,
          elementHtml: occ.elementHtml,
          selector: occ.selector ?? "",
        });

        if (!fix)
          return {
            content: [{ type: "text", text: "Could not generate fix" }],
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
            { type: "text", text: JSON.stringify(suggestion, null, 2) },
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
      async ({ organizationId, siteId, limit }) => {
        const start = Date.now();
        this.orgId = organizationId;
        const pre = await this.preflight("remediation:write");
        if (!pre.allowed)
          return { content: [{ type: "text", text: pre.error! }] };

        const findings = await prisma.canonicalFinding.findMany({
          where: {
            siteId,
            status: "OPEN",
            site: { workspace: { organizationId } },
          },
          include: { occurrences: { take: 1 } },
          take: limit,
        });

        const results = [];
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
              type: "text",
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
      {
        organizationId: z.string(),
        suggestionId: z.string(),
      },
      async ({ organizationId, suggestionId }) => {
        const start = Date.now();
        this.orgId = organizationId;

        const suggestion = await prisma.remediationSuggestion.findFirst({
          where: {
            id: suggestionId,
            canonicalFinding: { site: { workspace: { organizationId } } },
          },
        });

        if (!suggestion)
          return { content: [{ type: "text", text: "Suggestion not found" }] };

        const updated = await prisma.remediationSuggestion.update({
          where: { id: suggestionId },
          data: { status: "APPROVED" },
        });

        await this.trackCall("aros.approve_suggestion", 300, start, true);
        return {
          content: [
            {
              type: "text",
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
      async ({ organizationId, suggestionId, reason }) => {
        const start = Date.now();
        this.orgId = organizationId;

        const suggestion = await prisma.remediationSuggestion.findFirst({
          where: {
            id: suggestionId,
            canonicalFinding: { site: { workspace: { organizationId } } },
          },
        });

        if (!suggestion)
          return { content: [{ type: "text", text: "Suggestion not found" }] };

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
              type: "text",
              text: JSON.stringify({ id: updated.id, status: updated.status }),
            },
          ],
        };
      },
    );

    // ═══════════════════════════════════════════════════════════════
    // CLUSTERS
    // ═══════════════════════════════════════════════════════════════

    this.server.tool(
      "aros.list_clusters",
      "List issue clusters (component-level groupings)",
      {
        organizationId: z.string(),
        siteId: z.string(),
      },
      async ({ organizationId, siteId }) => {
        const start = Date.now();
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
          orderBy: { pageCount: "desc" },
        });

        await this.trackCall("aros.list_clusters", 200, start, true);
        return {
          content: [{ type: "text", text: JSON.stringify(clusters, null, 2) }],
        };
      },
    );

    this.server.tool(
      "aros.get_cluster",
      "Get cluster details including all member findings",
      {
        organizationId: z.string(),
        clusterId: z.string(),
      },
      async ({ organizationId, clusterId }) => {
        const start = Date.now();
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
            remediationSuggestions: { take: 5, orderBy: { createdAt: "desc" } },
          },
        });

        if (!cluster)
          return { content: [{ type: "text", text: "Cluster not found" }] };

        await this.trackCall("aros.get_cluster", 400, start, true);
        return {
          content: [{ type: "text", text: JSON.stringify(cluster, null, 2) }],
        };
      },
    );

    // ═══════════════════════════════════════════════════════════════
    // SUGGESTIONS
    // ═══════════════════════════════════════════════════════════════

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
      async ({ organizationId, siteId, status, limit }) => {
        const start = Date.now();
        this.orgId = organizationId;

        const suggestions = await prisma.remediationSuggestion.findMany({
          where: {
            canonicalFinding: {
              site: {
                workspace: { organizationId },
                ...(siteId ? { id: undefined, siteId } : {}),
              },
            },
            ...(status ? { status } : {}),
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
          orderBy: { createdAt: "desc" },
          take: limit,
        });

        await this.trackCall("aros.list_suggestions", 300, start, true);
        return {
          content: [
            { type: "text", text: JSON.stringify(suggestions, null, 2) },
          ],
        };
      },
    );

    // ═══════════════════════════════════════════════════════════════
    // EXPORTS
    // ═══════════════════════════════════════════════════════════════

    this.server.tool(
      "aros.export_findings",
      "Export findings as JSON or CSV",
      {
        organizationId: z.string(),
        siteId: z.string(),
        format: z.enum(["json", "csv"]).default("json"),
        status: z.string().optional(),
      },
      async ({ organizationId, siteId, format }) => {
        const start = Date.now();
        this.orgId = organizationId;

        const findings = await prisma.canonicalFinding.findMany({
          where: { siteId, site: { workspace: { organizationId } } },
          include: {
            occurrences: {
              take: 1,
              include: { page: { select: { url: true } } },
            },
          },
          orderBy: [{ impact: "asc" }],
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
              { type: "text", text: [headers.join(","), ...rows].join("\n") },
            ],
          };
        }

        await this.trackCall("aros.export_findings", 1000, start, true);
        return {
          content: [
            { type: "text", text: JSON.stringify(exportData, null, 2) },
          ],
        };
      },
    );

    this.server.tool(
      "aros.get_conformance_report",
      "Generate a conformance report with evidence",
      {
        organizationId: z.string(),
        siteId: z.string(),
      },
      async ({ organizationId, siteId }) => {
        const start = Date.now();
        this.orgId = organizationId;
        const pre = await this.preflight("reports:read");
        if (!pre.allowed)
          return { content: [{ type: "text", text: pre.error! }] };

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
          orderBy: { createdAt: "desc" },
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
          content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
        };
      },
    );

    // ═══════════════════════════════════════════════════════════════
    // WCAG KNOWLEDGE
    // ═══════════════════════════════════════════════════════════════

    this.server.tool(
      "aros.get_wcag_criterion",
      "Get WCAG criterion details and techniques",
      {
        criterionId: z.string().describe('WCAG criterion ID, e.g. "1.1.1"'),
      },
      async ({ criterionId }) => {
        const start = Date.now();

        const { wcagCriteriaMap } = await import("@aros/shared");
        const normalized = criterionId.replace(/[^a-z0-9]/gi, "").toLowerCase();
        const criterion = wcagCriteriaMap[`wcag${normalized}`];

        if (!criterion) {
          return {
            content: [
              {
                type: "text",
                text: `WCAG criterion ${criterionId} not found in local database. Full criteria available at https://www.w3.org/WAI/WCAG22/Understanding/`,
              },
            ],
          };
        }

        await this.trackCall("aros.get_wcag_criterion", 100, start, true);
        return {
          content: [{ type: "text", text: JSON.stringify(criterion, null, 2) }],
        };
      },
    );

    // ═══════════════════════════════════════════════════════════════
    // USAGE & BILLING
    // ═══════════════════════════════════════════════════════════════

    this.server.tool(
      "aros.get_usage",
      "Get MCP API usage stats for billing",
      {
        organizationId: z.string(),
        days: z.number().default(30),
      },
      async ({ organizationId, days }) => {
        const start = Date.now();
        this.orgId = organizationId;

        const { getUsageStats } = await import("./billing");
        const stats = await getUsageStats(organizationId, days);

        await this.trackCall("aros.get_usage", 200, start, true);
        return {
          content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
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
