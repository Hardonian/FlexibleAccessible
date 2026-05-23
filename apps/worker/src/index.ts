import { Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@aros/db";
import { recordWorkerHeartbeat } from "@aros/core-services";
import { handleCrawlJob } from "./jobs/crawl";
import { handleScanJob } from "./jobs/scan";
import { handleClusterJob } from "./jobs/cluster";
import { handleRemediationJob } from "./jobs/remediation";
import { handlePublicScanJob } from "./jobs/public-scan";
import { AgentOrchestrator } from "@aros/agents";
import { bullmqConnectionOptions, VISUAL_REVIEW_QUEUE_NAME, workerLogger } from "@aros/shared";
import { startScheduledCrawlLoop } from "./services/scheduled-crawls";
import { runSiteOpsAlertTick } from "./services/site-ops-alerts";

async function handleVisualReviewJob(job: any) {
  const { siteId, scanRunId, organizationId } = job.data;
  workerLogger.info(`[VisualReview] Starting job ${job.id} for site ${siteId}, run ${scanRunId}`);
  
  const orchestrator = new AgentOrchestrator();
  return orchestrator.runFullPipeline({
    siteId,
    organizationId: organizationId || "org_000000000000000000000000",
    metadata: { scanRunId }
  });
}

const connection = bullmqConnectionOptions();
const redisForShutdown = new IORedis(connection.url, {
  maxRetriesPerRequest: null,
});

const concurrency = parseInt(process.env.WORKER_CONCURRENCY ?? "3");

workerLogger.info("Starting AROS workers...");
workerLogger.info(`Concurrency: ${concurrency}`);

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

const visualReviewWorker = new Worker(VISUAL_REVIEW_QUEUE_NAME, handleVisualReviewJob, {
  connection,
  concurrency: 2,
});

function setupWorkerEvents(worker: Worker, name: string) {
  worker.on("completed", (job) => {
    workerLogger.info(`[${name}] Job ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    workerLogger.error(`[${name}] Job ${job?.id} failed: ${err.message}`, { error: err });
  });
  worker.on("error", (err) => {
    workerLogger.error(`[${name}] Worker error: ${err.message}`, { error: err });
  });
}

setupWorkerEvents(crawlWorker, "Crawl");
setupWorkerEvents(scanWorker, "Scan");
setupWorkerEvents(clusterWorker, "Cluster");
setupWorkerEvents(remediationWorker, "Remediation");
setupWorkerEvents(publicScanWorker, "PublicScan");
setupWorkerEvents(visualReviewWorker, "VisualReview");

const HEARTBEAT_MS = 30_000;
async function heartbeatTick() {
  try {
    await recordWorkerHeartbeat(prisma);
  } catch (e) {
    workerLogger.error("Platform heartbeat failed", { error: e });
  }
}
void heartbeatTick();
const heartbeatInterval = setInterval(() => {
  void heartbeatTick();
}, HEARTBEAT_MS);

const scheduledCrawlInterval = startScheduledCrawlLoop(prisma);


const SITE_OPS_ALERT_INTERVAL_MS = 5 * 60_000;
async function siteOpsAlertTick() {
  try {
    const result = await runSiteOpsAlertTick(prisma);
    if (result.transitionsDetected > 0) {
      workerLogger.info(`[SiteOpsAlert] checked=${result.checked} transitions=${result.transitionsDetected} notifications=${result.notificationsSent}`);
    }
  } catch (e) {
    workerLogger.error("[SiteOpsAlert] tick failed", { error: e });
  }
}
void siteOpsAlertTick();
const siteOpsAlertInterval = setInterval(() => {
  void siteOpsAlertTick();
}, SITE_OPS_ALERT_INTERVAL_MS);


async function shutdown() {
  workerLogger.info("Shutting down...");
  clearInterval(heartbeatInterval);
  clearInterval(scheduledCrawlInterval);
  clearInterval(siteOpsAlertInterval);
  await Promise.all([
    crawlWorker.close(),
    scanWorker.close(),
    clusterWorker.close(),
    remediationWorker.close(),
    publicScanWorker.close(),
    visualReviewWorker.close(),
  ]);
  await prisma.$disconnect().catch(() => undefined);
  await redisForShutdown.quit();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

workerLogger.info("All workers started successfully");
