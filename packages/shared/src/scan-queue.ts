import { Queue } from 'bullmq';
import { bullmqConnectionOptions } from './redis-connection';

/** BullMQ queue name for site verification scans (must match worker consumer). */
export const SCAN_QUEUE_NAME = 'scan' as const;

let sharedScanQueue: Queue | null = null;

/**
 * Singleton scan queue for producers (Next.js server, core-services).
 * Avoids opening a new Redis connection on every enqueue.
 */
export function getSharedScanQueue(): Queue {
  if (!sharedScanQueue) {
    sharedScanQueue = new Queue(SCAN_QUEUE_NAME, { connection: bullmqConnectionOptions() });
  }
  return sharedScanQueue;
}
