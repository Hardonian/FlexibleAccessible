import IORedis from 'ioredis';
import { bullmqConnectionOptions, VISUAL_REVIEW_QUEUE_NAME } from '@aros/shared';
import { Queue } from 'bullmq';
import type { DependencyCheckResult, JobQueueDepthSnapshot } from './types';

export async function checkPostgres(ping: () => Promise<unknown>): Promise<DependencyCheckResult> {
  const checkedAt = new Date().toISOString();
  try {
    await ping();
    return { ok: true, checkedAt };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Database unreachable';
    return { ok: false, message, checkedAt };
  }
}

export async function checkRedisPing(url: string): Promise<DependencyCheckResult> {
  const checkedAt = new Date().toISOString();
  const client = new IORedis(url, { maxRetriesPerRequest: 1, connectTimeout: 3000, lazyConnect: true });
  try {
    await client.connect();
    const pong = await client.ping();
    if (pong !== 'PONG') {
      return { ok: false, message: `Unexpected PING response: ${pong}`, checkedAt };
    }
    return { ok: true, checkedAt };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Redis unreachable';
    return { ok: false, message, checkedAt };
  } finally {
    await client.quit().catch(() => client.disconnect());
  }
}

/**
 * Opens short-lived queue handles to read counts. Fails closed if Redis is down.
 */
export async function getQueueDepths(): Promise<{
  ok: true;
  snapshot: JobQueueDepthSnapshot;
  checkedAt: string;
} | { ok: false; message: string; checkedAt: string }> {
  const checkedAt = new Date().toISOString();
  const connection = bullmqConnectionOptions();
  const q = (name: string) => new Queue(name, { connection });

  const crawl = q('crawl');
  const scan = q('scan');
  const cluster = q('cluster');
  const remediation = q('remediation');
  const publicScan = q('public-scan');
  const visualReview = q(VISUAL_REVIEW_QUEUE_NAME);

  try {
    const [c, s, cl, r, ps, vr] = await Promise.all([
      crawl.getJobCounts('waiting', 'active', 'failed'),
      scan.getJobCounts('waiting', 'active', 'failed'),
      cluster.getJobCounts('waiting', 'active', 'failed'),
      remediation.getJobCounts('waiting', 'active', 'failed'),
      publicScan.getJobCounts('waiting', 'active', 'failed'),
      visualReview.getJobCounts('waiting', 'active', 'failed'),
    ]);

    const snapshot: JobQueueDepthSnapshot = {
      crawl: { waiting: c.waiting ?? 0, active: c.active ?? 0, failed: c.failed ?? 0 },
      scan: { waiting: s.waiting ?? 0, active: s.active ?? 0, failed: s.failed ?? 0 },
      cluster: { waiting: cl.waiting ?? 0, active: cl.active ?? 0, failed: cl.failed ?? 0 },
      remediation: { waiting: r.waiting ?? 0, active: r.active ?? 0, failed: r.failed ?? 0 },
      publicScan: { waiting: ps.waiting ?? 0, active: ps.active ?? 0, failed: ps.failed ?? 0 },
      visualReview: { waiting: vr.waiting ?? 0, active: vr.active ?? 0, failed: vr.failed ?? 0 },
    };

    return { ok: true, snapshot, checkedAt };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not read queue metrics';
    return { ok: false, message, checkedAt };
  } finally {
    await Promise.all([
      crawl.close(),
      scan.close(),
      cluster.close(),
      remediation.close(),
      publicScan.close(),
      visualReview.close(),
    ]);
  }
}
