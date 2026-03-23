'use server';

import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';

export async function generateReportAction(formData: FormData) {
  const user = await requireSession();
  const siteId = formData.get('siteId') as string;
  const format = formData.get('format') as string;

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
  });
  if (!membership) throw new Error('No membership');

  const where: Record<string, unknown> = {
    occurrences: {
      some: {
        page: {
          site: {
            workspace: { organizationId: membership.organizationId },
            ...(siteId ? { id: siteId } : {}),
          },
        },
      },
    },
  };

  const findings = await prisma.canonicalFinding.findMany({
    where,
    include: {
      occurrences: {
        include: { page: { select: { url: true, title: true } } },
        take: 100,
      },
    },
    orderBy: [{ impact: 'asc' }, { occurrenceCount: 'desc' }],
  });

  const report = {
    generatedAt: new Date().toISOString(),
    generatedBy: user.email,
    disclaimer: 'This report provides evidence of automated accessibility testing. It does not constitute a guarantee of WCAG conformance. Some criteria require manual expert review.',
    summary: {
      totalFindings: findings.length,
      bySeverity: {
        critical: findings.filter((f) => f.impact === 'CRITICAL').length,
        serious: findings.filter((f) => f.impact === 'SERIOUS').length,
        moderate: findings.filter((f) => f.impact === 'MODERATE').length,
        minor: findings.filter((f) => f.impact === 'MINOR').length,
      },
      byStatus: {
        open: findings.filter((f) => f.status === 'OPEN').length,
        acknowledged: findings.filter((f) => f.status === 'ACKNOWLEDGED').length,
        inProgress: findings.filter((f) => f.status === 'IN_PROGRESS').length,
        resolved: findings.filter((f) => f.status === 'RESOLVED').length,
        mitigated: findings.filter((f) => f.status === 'MITIGATED').length,
        falsePositive: findings.filter((f) => f.status === 'FALSE_POSITIVE').length,
        wontFix: findings.filter((f) => f.status === 'WONT_FIX').length,
      },
    },
    findings: findings.map((f) => ({
      id: f.id,
      ruleId: f.ruleId,
      impact: f.impact,
      status: f.status,
      description: f.description,
      wcagTags: f.wcagTags,
      occurrenceCount: f.occurrenceCount,
      firstSeenAt: f.firstSeenAt,
      lastSeenAt: f.lastSeenAt,
      affectedPages: f.occurrences.map((o) => ({
        url: o.page.url,
        title: o.page.title,
        selector: o.selector,
      })),
    })),
  };

  // In a full implementation, this would return a file download response.
  // For now, we store the report data. A proper implementation would use
  // a Route Handler (GET) to return the file.
  console.log(`Report generated in ${format} format:`, JSON.stringify(report).length, 'bytes');

  // In production, this would redirect to a download URL
  return;
}
