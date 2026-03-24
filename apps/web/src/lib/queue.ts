import { Queue } from 'bullmq';
import { bullmqConnectionOptions, getSharedScanQueue } from '@aros/shared';

let crawlQueueInstance: Queue | null = null;
let clusterQueueInstance: Queue | null = null;
let remediationQueueInstance: Queue | null = null;

function connection() {
  return bullmqConnectionOptions();
}

/**
 * Lazy BullMQ queue handles so importing this module during Next.js static analysis
 * does not open Redis connections (avoids build-time ECONNREFUSED noise).
 */
export function getCrawlQueue(): Queue {
  if (!crawlQueueInstance) {
    crawlQueueInstance = new Queue('crawl', { connection: connection() });
  }
  return crawlQueueInstance;
}

export function getScanQueue(): Queue {
  return getSharedScanQueue();
}

export function getClusterQueue(): Queue {
  if (!clusterQueueInstance) {
    clusterQueueInstance = new Queue('cluster', { connection: connection() });
  }
  return clusterQueueInstance;
}

export function getRemediationQueue(): Queue {
  if (!remediationQueueInstance) {
    remediationQueueInstance = new Queue('remediation', { connection: connection() });
  }
  return remediationQueueInstance;
}

export interface CrawlJobData {
  crawlRunId: string;
  siteId: string;
  config: {
    sitemapUrl?: string;
    maxDepth: number;
    maxPages: number;
    includePatterns: string[];
    excludePatterns: string[];
    respectRobots: boolean;
    renderJavaScript: boolean;
    viewports: Array<{ width: number; height: number }>;
    authConfig?: unknown;
    customHeaders?: Record<string, string>;
  };
}

export interface ScanJobData {
  scanRunId: string;
  siteId: string;
  pageId: string;
  pageUrl: string;
  snapshotId?: string;
}

export interface ClusterJobData {
  siteId: string;
  scanRunId: string;
}

export interface RemediationJobData {
  findingId: string;
  clusterId?: string;
  siteId: string;
}
