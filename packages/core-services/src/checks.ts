/**
 * Infrastructure Health Checks
 * 
 * REFACTORED: Now using standardized patterns from @aros/shared
 * - StandardResult<T> for type-safe results
 * - SystemPosture for health aggregation
 * - Fail-closed semantics
 */

import IORedis from 'ioredis';
import { bullmqConnectionOptions, VISUAL_REVIEW_QUEUE_NAME } from '@aros/shared';
import { Queue } from 'bullmq';
import type { JobQueueDepthSnapshot } from './types';
import { 
  type StandardResult, 
  type ComponentPosture,
  success, 
  failure,
  buildComponentPosture,
} from '@aros/shared';

/**
 * Generate trace ID for observability
 */
function generateTraceId(): string {
  return `chk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check Postgres connectivity using standardized Result pattern
 * 
 * @param ping - Function that pings the database
 * @returns StandardResult with void data on success
 */
export async function checkPostgres(
  ping: () => Promise<unknown>
): Promise<StandardResult<void>> {
  const traceId = generateTraceId();
  const startTime = Date.now();
  
  try {
    await ping();
    return success(undefined, {
      traceId,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Database unreachable';
    return failure('unavailable', {
      message,
      code: 'DB_UNREACHABLE',
    }, {
      traceId,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      reasonCodes: ['DB_CONNECTION_FAILED'],
    });
  }
}

/**
 * Check Redis connectivity using standardized Result pattern
 * 
 * @param url - Redis connection URL
 * @returns StandardResult with void data on success
 */
export async function checkRedisPing(
  url: string
): Promise<StandardResult<void>> {
  const traceId = generateTraceId();
  const startTime = Date.now();
  const client = new IORedis(url, { 
    maxRetriesPerRequest: 1, 
    connectTimeout: 3000, 
    lazyConnect: true 
  });
  
  try {
    await client.connect();
    const pong = await client.ping();
    if (pong !== 'PONG') {
      return failure('degraded', {
        message: `Unexpected PING response: ${pong}`,
        code: 'REDIS_UNEXPECTED_RESPONSE',
      }, {
        traceId,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        reasonCodes: ['REDIS_PROTOCOL_MISMATCH'],
      });
    }
    return success(undefined, {
      traceId,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Redis unreachable';
    return failure('unavailable', {
      message,
      code: 'REDIS_UNREACHABLE',
    }, {
      traceId,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      reasonCodes: ['REDIS_CONNECTION_FAILED'],
    });
  } finally {
    await client.quit().catch(() => client.disconnect());
  }
}

/**
 * Get component posture for Redis (for SystemPosture aggregation)
 */
export async function getRedisPosture(url: string): Promise<ComponentPosture> {
  const result = await checkRedisPing(url);
  
  return buildComponentPosture(
    {
      id: 'redis',
      name: 'Redis Connection',
      criticality: 'critical',
      category: 'queue',
    },
    result.ok ? 'ok' : 'failed',
    result.ok ? 'Connected and responding to PING' : (result.error?.message ?? 'Connection failed'),
    {
      reasonCodes: result.ok ? [] : (result.metadata.reasonCodes ?? []),
    }
  );
}

/**
 * Get component posture for Postgres (for SystemPosture aggregation)
 */
export async function getPostgresPosture(
  ping: () => Promise<unknown>
): Promise<ComponentPosture> {
  const result = await checkPostgres(ping);
  
  return buildComponentPosture(
    {
      id: 'postgres',
      name: 'PostgreSQL Database',
      criticality: 'critical',
      category: 'data',
    },
    result.ok ? 'ok' : 'failed',
    result.ok ? 'Database responding to queries' : (result.error?.message ?? 'Database unreachable'),
    {
      reasonCodes: result.ok ? [] : (result.metadata.reasonCodes ?? []),
    }
  );
}

/**
 * Get queue depths with standardized Result pattern
 * Fails closed if Redis is down.
 * 
 * @returns StandardResult with JobQueueDepthSnapshot
 */
export async function getQueueDepths(): Promise<StandardResult<JobQueueDepthSnapshot>> {
  const traceId = generateTraceId();
  const startTime = Date.now();
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

    return success(snapshot, {
      traceId,
      durationMs: Date.now() - startTime,
      timestamp: checkedAt,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not read queue metrics';
    return failure('unavailable', {
      message,
      code: 'QUEUE_METRICS_UNAVAILABLE',
    }, {
      traceId,
      durationMs: Date.now() - startTime,
      timestamp: checkedAt,
      reasonCodes: ['QUEUE_CONNECTION_FAILED'],
    });
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

/**
 * Get queue component posture (for SystemPosture aggregation)
 */
export async function getQueuePosture(): Promise<ComponentPosture> {
  const result = await getQueueDepths();
  
  return buildComponentPosture(
    {
      id: 'bullmq',
      name: 'BullMQ Job Queues',
      criticality: 'critical',
      category: 'queue',
    },
    result.ok ? 'ok' : 'failed',
    result.ok ? 'All queues readable' : (result.error?.message ?? 'Queue metrics unavailable'),
    {
      reasonCodes: result.ok ? [] : (result.metadata.reasonCodes ?? []),
    }
  );
}