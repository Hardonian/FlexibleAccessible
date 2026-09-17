import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const openApiSpec = {
      openapi: "3.1.0",
      info: {
        title: "AROS (Accessibility Remediation OS) Public API",
        version: "1.0.0",
        description:
          "Deterministic, evidence-backed accessibility scanning, automated remediation recipes, and VPAT compliance reporting APIs.",
        contact: {
          name: "AROS Engineering & Support",
          email: "support@aros.dev",
          url: "https://aros.dev",
        },
        license: {
          name: "Commercial / Proprietary",
          url: "https://aros.dev/legal/terms",
        },
      },
      servers: [
        {
          url: "https://aros.dev",
          description: "Production Server",
        },
        {
          url: "http://localhost:3000",
          description: "Local Development Server",
        },
      ],
      paths: {
        "/api/health": {
          get: {
            summary: "System Health & Canary Heartbeat",
            description: "Returns platform uptime, database connectivity, and Redis queue status.",
            parameters: [
              {
                name: "detailed",
                in: "query",
                required: false,
                schema: { type: "boolean" },
                description: "Include subsystem component health diagnostics",
              },
            ],
            responses: {
              "200": {
                description: "System healthy",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        status: { type: "string", example: "ok" },
                        timestamp: { type: "string", format: "date-time" },
                        database: { type: "string", example: "connected" },
                        redis: { type: "string", example: "connected" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "/api/public-scan": {
          post: {
            summary: "Execute Instant Public Accessibility Scan",
            description: "Initiates a rate-limited, single-page Axe-core accessibility audit for a public domain.",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["domain"],
                    properties: {
                      domain: { type: "string", format: "hostname", example: "example.com" },
                    },
                  },
                },
              },
            },
            responses: {
              "200": {
                description: "Scan successfully completed with Pareto 80/20 cluster findings",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        ok: { type: "boolean", example: true },
                        domain: { type: "string" },
                        totalViolations: { type: "integer" },
                        criticalViolations: { type: "integer" },
                        clusters: { type: "array", items: { type: "object" } },
                      },
                    },
                  },
                },
              },
              "429": {
                description: "Rate limit exceeded (300-second window)",
              },
            },
          },
        },
        "/api/badge": {
          get: {
            summary: "Embeddable Live Compliance SVG Badge",
            description: "Generates a zero-JavaScript, cached SVG badge displaying verified compliance status.",
            parameters: [
              {
                name: "domain",
                in: "query",
                required: true,
                schema: { type: "string" },
                description: "Domain name of verified organization",
              },
            ],
            responses: {
              "200": {
                description: "Live SVG Badge",
                content: {
                  "image/svg+xml": {},
                },
              },
            },
          },
        },
        "/api/deploy-webhook": {
          post: {
            summary: "Trigger Post-Deploy Regression Scan",
            description: "CI/CD webhook endpoint for GitHub Actions, Vercel, and GitLab CI to initiate regression audits.",
            parameters: [
              {
                name: "x-aros-webhook-secret",
                in: "header",
                required: true,
                schema: { type: "string" },
                description: "Workspace webhook signing secret",
              },
            ],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["siteId"],
                    properties: {
                      siteId: { type: "string" },
                      gitCommitSha: { type: "string" },
                      deploymentUrl: { type: "string", format: "uri" },
                    },
                  },
                },
              },
            },
            responses: {
              "202": {
                description: "Crawl and audit job enqueued",
              },
            },
          },
        },
        "/api/reports/vpat": {
          get: {
            summary: "Export Official VPAT 2.5 Conformance Document",
            description: "Exports Section 508 / EN 301 549 / WCAG 2.2 AA conformance data in HTML or JSON format.",
            security: [{ BearerAuth: [] }],
            parameters: [
              {
                name: "organizationId",
                in: "query",
                required: true,
                schema: { type: "string" },
              },
              {
                name: "format",
                in: "query",
                required: false,
                schema: { type: "string", enum: ["json", "html"] },
              },
            ],
            responses: {
              "200": {
                description: "VPAT conformance report document",
              },
            },
          },
        },
        "/api/org/{organizationId}/audit-log": {
          get: {
            summary: "Export Fine-Grained Tenant Audit Logs",
            description: "Buyer-grade tamper-evident audit trail for enterprise procurement and compliance reviews.",
            security: [{ BearerAuth: [] }],
            parameters: [
              {
                name: "organizationId",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
              {
                name: "format",
                in: "query",
                required: false,
                schema: { type: "string", enum: ["json", "csv"], default: "json" },
              },
            ],
            responses: {
              "200": {
                description: "Exported audit logs array or CSV stream",
              },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    };

    return NextResponse.json(openApiSpec, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[OPENAPI_ERROR]", err);
    return NextResponse.json({ error: "Failed to generate OpenAPI specification" }, { status: 500 });
  }
}
