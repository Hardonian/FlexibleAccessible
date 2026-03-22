import { Queue } from 'bullmq';
import { bullmqConnectionOptions } from '@aros/shared';

const connection = bullmqConnectionOptions();

export const crawlQueue = new Queue('crawl', { connection });
export const scanQueue = new Queue('scan', { connection });
export const clusterQueue = new Queue('cluster', { connection });
export const remediationQueue = new Queue('remediation', { connection });

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
