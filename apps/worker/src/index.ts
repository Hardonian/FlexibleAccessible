import { Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@aros/db";
import { recordWorkerHeartbeat } from "@aros/core-services";
import { bullmqConnectionOptions } from "@aros/shared";
import { handleCrawlJob } from "./jobs/crawl";
import { handleScanJob } from "./jobs/scan";
import { handleClusterJob } from "./jobs/cluster";
import { handleRemediationJob } from "./jobs/remediation";
import { handlePublicScanJob } from "./jobs/public-scan";

const connection = bullmqConnectionOptions();
const redisForShutdown = new IORedis(connection.url, {
  maxRetriesPerRequest: null,
});

const concurrency = parseInt(process.env.WORKER_CONCURRENCY ?? "3");

console.log("[Worker] Starting AROS workers...");
console.log(`[Worker] Concurrency: ${concurrency}`);

const crawlWorker = new Worker("crawl", handleCrawlJob, {
  connection,
  concurrency,
  limiter: { max: 5, duration: 60000 },
});

const scanWorker = new Worker("scan", handleScanJob, {
  connection,
  concurrency: concurrency * 2,
});

const clusterWorker = new Worker("cluster", handleClusterJob, {
  connection,
  concurrency: 1,
});

const remediationWorker = new Worker("remediation", handleRemediationJob, {
  connection,
  concurrency: 2,
  limiter: {
    max: 10,
    duration: 60000,
  },
});

const publicScanWorker = new Worker("public-scan", handlePublicScanJob, {
  connection,
  concurrency: 2,
  limiter: { max: 3, duration: 60000 },
});

function setupWorkerEvents(worker: Worker, name: string) {
  worker.on("completed", (job) => {
    console.log(`[${name}] Job ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[${name}] Job ${job?.id} failed:`, err.message);
  });
  worker.on("error", (err) => {
    console.error(`[${name}] Worker error:`, err.message);
  });
}

setupWorkerEvents(crawlWorker, "Crawl");
setupWorkerEvents(scanWorker, "Scan");
setupWorkerEvents(clusterWorker, "Cluster");
setupWorkerEvents(remediationWorker, "Remediation");

const HEARTBEAT_MS = 30_000;
async function heartbeatTick() {
  try {
    await recordWorkerHeartbeat(prisma);
  } catch (e) {
    console.error(
      "[Worker] Platform heartbeat failed:",
      e instanceof Error ? e.message : e,
    );
  }
}
void heartbeatTick();
const heartbeatInterval = setInterval(() => {
  void heartbeatTick();
}, HEARTBEAT_MS);

async function shutdown() {
  console.log("[Worker] Shutting down...");
  clearInterval(heartbeatInterval);
  await Promise.all([
    crawlWorker.close(),
    scanWorker.close(),
    clusterWorker.close(),
    remediationWorker.close(),
  ]);
  await prisma.$disconnect().catch(() => undefined);
  await redisForShutdown.quit();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[Worker] All workers started successfully");
