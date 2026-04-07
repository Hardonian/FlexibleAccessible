import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@aros/db";
import {
  loadRemediationSuggestionForOrg,
  loadReviewTaskForOrg,
  updateReviewTaskStatusForOrg,
} from "@/lib/dashboard-org-scoped-prisma";

const prisma = new PrismaClient();

let databaseReachable = false;
if (process.env.DATABASE_URL) {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    databaseReachable = true;
  } catch {
    await prisma.$disconnect().catch(() => {});
  }
}

const describeDb = databaseReachable ? describe.sequential : describe.skip;

describeDb("tenant isolation (org-scoped helpers)", () => {
  const suffix = `ti-${Date.now()}`;
  let orgAId: string;
  let orgBId: string;
  let siteAId: string;
  let suggestionId: string;
  let reviewTaskId: string;

  beforeAll(async () => {
    const orgA = await prisma.organization.create({
      data: { name: `Tenant A ${suffix}`, slug: `tenant-a-${suffix}` },
    });
    orgAId = orgA.id;
    const orgB = await prisma.organization.create({
      data: { name: `Tenant B ${suffix}`, slug: `tenant-b-${suffix}` },
    });
    orgBId = orgB.id;

    await prisma.subscription.create({
      data: {
        organizationId: orgAId,
        plan: "STARTER",
        status: "ACTIVE",
        maxDomains: 10,
        maxPagesPerCrawl: 500,
        maxScansPerMonth: 100,
        maxSeats: 10,
      },
    });

    const wsA = await prisma.workspace.create({
      data: {
        organizationId: orgAId,
        name: "Main",
        slug: `main-${suffix}`,
      },
    });
    await prisma.workspace.create({
      data: {
        organizationId: orgBId,
        name: "Main",
        slug: `main-b-${suffix}`,
      },
    });

    const siteA = await prisma.site.create({
      data: {
        workspaceId: wsA.id,
        name: "Site A",
        domain: `https://a-${suffix}.example.com`,
      },
    });
    siteAId = siteA.id;

    const cluster = await prisma.issueCluster.create({
      data: {
        siteId: siteAId,
        name: "Cluster",
        severity: "SERIOUS",
        impactScore: 10,
        findingCount: 1,
        pageCount: 1,
      },
    });

    const suggestion = await prisma.remediationSuggestion.create({
      data: {
        clusterId: cluster.id,
        type: "ALT_TEXT",
        status: "DRAFT",
        originalCode: "<img src=x>",
        suggestedCode: "<img src=x alt=y>",
        rationale: "test",
      },
    });
    suggestionId = suggestion.id;

    const task = await prisma.reviewTask.create({
      data: {
        suggestionId: suggestion.id,
        type: "SUGGESTION_REVIEW",
        status: "PENDING",
        title: "Review",
      },
    });
    reviewTaskId = task.id;
  });

  afterAll(async () => {
    await prisma.reviewTask.deleteMany({ where: { id: reviewTaskId } }).catch(() => {});
    await prisma.remediationSuggestion.deleteMany({ where: { id: suggestionId } }).catch(() => {});
    await prisma.issueCluster.deleteMany({ where: { siteId: siteAId } }).catch(() => {});
    await prisma.site.deleteMany({ where: { id: siteAId } }).catch(() => {});
    await prisma.workspace.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    }).catch(() => {});
    await prisma.subscription.deleteMany({ where: { organizationId: orgAId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("does not load another org's remediation suggestion by id", async () => {
    const row = await loadRemediationSuggestionForOrg(suggestionId, orgBId);
    expect(row).toBeNull();
  });

  it("loads the suggestion when organization matches", async () => {
    const row = await loadRemediationSuggestionForOrg(suggestionId, orgAId);
    expect(row).not.toBeNull();
    expect(row?.id).toBe(suggestionId);
  });

  it("does not load another org's review task by id", async () => {
    const row = await loadReviewTaskForOrg(reviewTaskId, orgBId);
    expect(row).toBeNull();
  });

  it("does not update review task when scoped to wrong org", async () => {
    const ok = await updateReviewTaskStatusForOrg(reviewTaskId, orgBId, {
      status: "APPROVED",
    });
    expect(ok).toBe(false);
    const unchanged = await prisma.reviewTask.findUnique({
      where: { id: reviewTaskId },
      select: { status: true },
    });
    expect(unchanged?.status).toBe("PENDING");
  });
});
