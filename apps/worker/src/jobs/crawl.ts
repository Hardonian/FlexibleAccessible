import { Job } from 'bullmq';
import { prisma } from '@aros/db';
import { chromium, type Browser, type Page } from 'playwright';

interface CrawlJobData {
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

export async function handleCrawlJob(job: Job<CrawlJobData>) {
  const { crawlRunId, siteId, config } = job.data;

  console.log(`[Crawl] Starting crawl ${crawlRunId} for site ${siteId}`);

  await prisma.crawlRun.update({
    where: { id: crawlRunId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    await prisma.crawlRun.update({
      where: { id: crawlRunId },
      data: { status: 'FAILED', errorMessage: 'Site not found' },
    });
    return;
  }

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [];
    let pagesCrawled = 0;

    // Discover initial URLs
    const baseUrl = site.domain.replace(/\/$/, '');

    // Try sitemap first
    if (config.sitemapUrl) {
      try {
        const sitemapUrls = await fetchSitemapUrls(config.sitemapUrl);
        for (const url of sitemapUrls.slice(0, config.maxPages)) {
          if (!visited.has(url)) {
            queue.push({ url, depth: 0 });
          }
        }
      } catch (err) {
        console.warn(`[Crawl] Sitemap fetch failed: ${err}`);
      }
    }

    // Always add the root URL
    if (!queue.some((q) => q.url === baseUrl || q.url === baseUrl + '/')) {
      queue.push({ url: baseUrl, depth: 0 });
    }

    await prisma.crawlRun.update({
      where: { id: crawlRunId },
      data: { pagesFound: queue.length },
    });

    // Crawl loop
    while (queue.length > 0 && pagesCrawled < config.maxPages) {
      const item = queue.shift();
      if (!item) break;

      const normalizedUrl = normalizeUrl(item.url);
      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      // Check include/exclude patterns
      if (!matchesPatterns(normalizedUrl, config.includePatterns, config.excludePatterns)) {
        continue;
      }

      try {
        const context = await browser.newContext({
          viewport: config.viewports[0] ?? { width: 1280, height: 720 },
          userAgent: 'AROS-Crawler/1.0 (Accessibility Scanner)',
          extraHTTPHeaders: config.customHeaders ?? {},
        });

        const page = await context.newPage();
        const consoleErrors: string[] = [];
        const networkErrors: string[] = [];

        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
          }
        });

        page.on('requestfailed', (request) => {
          networkErrors.push(`${request.url()} - ${request.failure()?.errorText ?? 'unknown'}`);
        });

        const response = await page.goto(normalizedUrl, {
          waitUntil: config.renderJavaScript ? 'networkidle' : 'domcontentloaded',
          timeout: 30000,
        });

        const statusCode = response?.status() ?? 0;

        if (statusCode >= 400) {
          await context.close();
          continue;
        }

        // Wait for dynamic content
        if (config.renderJavaScript) {
          await page.waitForTimeout(2000);
        }

        const title = await page.title();
        const content = await page.content();
        const path = new URL(normalizedUrl).pathname;

        // Take screenshot
        const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });
        const screenshotKey = `crawl/${crawlRunId}/${encodeURIComponent(path)}.png`;

        // Get accessibility tree snapshot
        const accessibilityTree = await getAccessibilityTree(page);

        // Store page data
        const dbPage = await prisma.page.upsert({
          where: { siteId_url: { siteId, url: normalizedUrl } },
          create: {
            siteId,
            url: normalizedUrl,
            path,
            title,
            statusCode,
            lastCrawledAt: new Date(),
          },
          update: {
            title,
            statusCode,
            lastCrawledAt: new Date(),
          },
        });

        // Store snapshot
        await prisma.pageSnapshot.create({
          data: {
            pageId: dbPage.id,
            crawlRunId,
            domSnapshot: content,
            screenshotKey,
            accessibilityTree: accessibilityTree as object,
            consoleErrors: consoleErrors.length > 0 ? consoleErrors : undefined,
            networkErrors: networkErrors.length > 0 ? networkErrors : undefined,
            viewport: config.viewports[0],
          },
        });

        pagesCrawled++;

        // Discover links if under max depth
        if (item.depth < config.maxDepth) {
          const links = await discoverLinks(page, baseUrl);
          for (const link of links) {
            if (!visited.has(normalizeUrl(link))) {
              queue.push({ url: link, depth: item.depth + 1 });
            }
          }
          await prisma.crawlRun.update({
            where: { id: crawlRunId },
            data: {
              pagesFound: visited.size + queue.length,
              pagesCrawled,
            },
          });
        }

        await context.close();

        // Update progress
        await job.updateProgress(Math.round((pagesCrawled / config.maxPages) * 100));
      } catch (err) {
        console.error(`[Crawl] Error crawling ${normalizedUrl}:`, err);
        await prisma.crawlRun.update({
          where: { id: crawlRunId },
          data: { pagesFailed: { increment: 1 } },
        });
      }
    }

    // Mark completed
    await prisma.crawlRun.update({
      where: { id: crawlRunId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        pagesCrawled,
        pagesFound: visited.size,
      },
    });

    console.log(`[Crawl] Completed crawl ${crawlRunId}: ${pagesCrawled} pages crawled`);
  } catch (err) {
    console.error(`[Crawl] Crawl ${crawlRunId} failed:`, err);
    await prisma.crawlRun.update({
      where: { id: crawlRunId },
      data: {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        completedAt: new Date(),
      },
    });
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const response = await fetch(sitemapUrl, {
    headers: { 'User-Agent': 'AROS-Crawler/1.0' },
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  const urls: string[] = [];
  const locRegex = /<loc>(.*?)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(text)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

async function discoverLinks(page: Page, baseUrl: string): Promise<string[]> {
  const links = await page.evaluate((base: string) => {
    const anchors = document.querySelectorAll('a[href]');
    const urls: string[] = [];
    anchors.forEach((a) => {
      const href = (a as HTMLAnchorElement).href;
      if (href && href.startsWith(base) && !href.includes('#')) {
        urls.push(href);
      }
    });
    return [...new Set(urls)];
  }, baseUrl);
  return links;
}

async function getAccessibilityTree(page: Page): Promise<unknown> {
  try {
    const withA11y = page as Page & {
      accessibility: { snapshot: (options?: { interestingOnly?: boolean }) => Promise<unknown> };
    };
    return await withA11y.accessibility.snapshot();
  } catch {
    return null;
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    let pathname = u.pathname.replace(/\/+$/, '') || '/';
    u.pathname = pathname;
    u.searchParams.sort();
    return u.toString();
  } catch {
    return url;
  }
}

function matchesPatterns(
  url: string,
  includePatterns: string[],
  excludePatterns: string[]
): boolean {
  if (excludePatterns.length > 0) {
    for (const pattern of excludePatterns) {
      if (url.includes(pattern)) return false;
    }
  }
  if (includePatterns.length > 0) {
    return includePatterns.some((pattern) => url.includes(pattern));
  }
  return true;
}
