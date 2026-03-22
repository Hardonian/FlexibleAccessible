import { NextResponse } from 'next/server';
import { collectPlatformHealth, toPublicHealthSummary } from '@aros/core-services';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Liveness + coarse readiness for load balancers. No authentication; no secrets or env keys.
 */
export async function GET() {
  try {
    const report = await collectPlatformHealth(prisma);
    const summary = toPublicHealthSummary(report);
    const status = summary.ready ? 200 : 503;
    return NextResponse.json(summary, { status });
  } catch (e) {
    console.error('[health] collection failed:', e);
    return NextResponse.json(
      {
        checkedAt: new Date().toISOString(),
        live: true,
        installed: false,
        readiness: 'blocked',
        ready: false,
        checks: { database: false, redis: false, session: false },
        error: 'health_collection_failed',
      },
      { status: 503 }
    );
  }
}
