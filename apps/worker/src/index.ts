import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { handleCrawlJob } from './jobs/crawl';
import { handleScanJob } from './jobs/scan';
import { handleClusterJob } from './jobs/cluster';
import { handleRemediationJob } from './jobs/remediation';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const concurrency = parseInt(process.env.WORKER_CONCURRENCY ?? '3');

console.log('[Worker] Starting AROS workers...');
console.log(`[Worker] Concurrency: ${concurrency}`);

const crawlWorker = new Worker('crawl', handleCrawlJob, {
  connection,
  concurrency,
  limiter: { max: 5, duration: 60000 },
});

const scanWorker = new Worker('scan', handleScanJob, {
  connection,
  concurrency: concurrency * 2,
});

const clusterWorker = new Worker('cluster', handleClusterJob, {
  connection,
  concurrency: 1,
});

const remediationWorker = new Worker('remediation', handleRemediationJob, {
  connection,
  concurrency: 2,
});

function setupWorkerEvents(worker: Worker, name: string) {
  worker.on('completed', (job) => {
    console.log(`[${name}] Job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[${name}] Job ${job?.id} failed:`, err.message);
  });
  worker.on('error', (err) => {
    console.error(`[${name}] Worker error:`, err.message);
  });
}

setupWorkerEvents(crawlWorker, 'Crawl');
setupWorkerEvents(scanWorker, 'Scan');
setupWorkerEvents(clusterWorker, 'Cluster');
setupWorkerEvents(remediationWorker, 'Remediation');

async function shutdown() {
  console.log('[Worker] Shutting down...');
  await Promise.all([
    crawlWorker.close(),
    scanWorker.close(),
    clusterWorker.close(),
    remediationWorker.close(),
  ]);
  await connection.quit();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('[Worker] All workers started successfully');
