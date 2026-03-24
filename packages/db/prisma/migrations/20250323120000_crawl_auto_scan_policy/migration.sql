-- Optional policy: enqueue verification scan after successful crawl (default on for existing sites)
ALTER TABLE "crawl_configs" ADD COLUMN "autoScanAfterCrawl" BOOLEAN NOT NULL DEFAULT true;
