import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { hasPermission } from '@aros/config';
import { collectPlatformHealth, buildRoutePlatformTruth } from '@aros/core-services';

export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const format = searchParams.get('format') ?? 'json';

    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      select: { organizationId: true, role: true },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!hasPermission(membership.role, 'reports:export')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const health = await collectPlatformHealth(prisma);
    const truth = buildRoutePlatformTruth(health);

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
      disclaimer:
        'This report provides evidence of accessibility testing and operator workflow. It does not constitute a guarantee of WCAG conformance.',
      platformTruth: {
        jobPipelinesHealthy: truth.flags.jobPipelinesHealthy,
        workerRunning: truth.flags.workerRunning,
        optionalSubsystemIssues: truth.optionalSubsystemIssues,
      },
      summary: {
        totalFindings: findings.length,
        bySeverity: {
          critical: findings.filter((f) => f.impact === 'CRITICAL').length,
          serious: findings.filter((f) => f.impact === 'SERIOUS').length,
          moderate: findings.filter((f) => f.impact === 'MODERATE').length,
          minor: findings.filter((f) => f.impact === 'MINOR').length,
        },
        byEvidenceSource: {
          automatedAxe: findings.filter((f) => f.evidenceSource === 'AUTOMATED_AXE').length,
          manualReview: findings.filter((f) => f.evidenceSource === 'MANUAL_REVIEW').length,
          imported: findings.filter((f) => f.evidenceSource === 'IMPORTED').length,
        },
      },
      findings: findings.map((f) => ({
        id: f.id,
        ruleId: f.ruleId,
        impact: f.impact,
        status: f.status,
        evidenceSource: f.evidenceSource,
        description: f.description,
        wcagTags: f.wcagTags,
        occurrenceCount: f.occurrenceCount,
        firstSeenAt: f.firstSeenAt,
        lastSeenAt: f.lastSeenAt,
        lastVerifiedAt: f.lastVerifiedAt,
        lastScanRunId: f.lastScanRunId,
        reopenedCount: f.reopenedCount,
        affectedPages: f.occurrences.map((o) => ({
          url: o.page.url,
          title: o.page.title,
          selector: o.selector,
        })),
      })),
    };

    if (format === 'csv') {
      const lines = ['Rule ID,Impact,Status,Description,Occurrences,WCAG Tags'];
      for (const f of report.findings) {
        lines.push(
          `"${f.ruleId}","${f.impact}","${f.status}","${f.description.replace(/"/g, '""')}",${f.occurrenceCount},"${f.wcagTags.join('; ')}"`
        );
      }
      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="aros-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json(report, {
      headers: {
        'Content-Disposition': `attachment; filename="aros-report-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Report generation error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
