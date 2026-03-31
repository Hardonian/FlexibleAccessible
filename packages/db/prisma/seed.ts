import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('Seeding database...');

  await prisma.platformState.upsert({
    where: { id: 'platform' },
    create: {
      id: 'platform',
      bootstrapVersion: 1,
      productFlags: {},
    },
    update: {},
  });

  // Create demo user
  const passwordHash = await hashPassword('demo1234');
  const user = await prisma.user.upsert({
    where: { email: 'demo@aros.dev' },
    create: {
      email: 'demo@aros.dev',
      name: 'Demo User',
      passwordHash,
      emailVerified: true,
    },
    update: {},
  });

  // Create demo organization
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    create: { name: 'Acme Corp', slug: 'acme-corp' },
    update: {},
  });

  // Membership
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    create: { userId: user.id, organizationId: org.id, role: 'OWNER' },
    update: {},
  });

  // Subscription
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      maxDomains: 10,
      maxPagesPerCrawl: 1000,
      maxScansPerMonth: 50,
      maxSeats: 10,
      aiEnabled: true,
      aiTokenLimit: 100000,
    },
    update: {},
  });

  // Workspace
  const workspace = await prisma.workspace.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'default' } },
    create: { organizationId: org.id, name: 'Default Workspace', slug: 'default' },
    update: {},
  });

  // Demo site
  const site = await prisma.site.upsert({
    where: { id: 'demo-site-1' },
    create: {
      id: 'demo-site-1',
      workspaceId: workspace.id,
      name: 'Acme Public Site',
      domain: 'https://example.com',
      environment: 'PRODUCTION',
    },
    update: {},
  });

  // Crawl config
  await prisma.crawlConfig.upsert({
    where: { siteId: site.id },
    create: {
      siteId: site.id,
      sitemapUrl: 'https://example.com/sitemap.xml',
      maxDepth: 5,
      maxPages: 500,
    },
    update: {},
  });

  // Demo crawl run
  const crawlRun = await prisma.crawlRun.create({
    data: {
      siteId: site.id,
      status: 'COMPLETED',
      pagesFound: 25,
      pagesCrawled: 25,
      startedAt: new Date(Date.now() - 3600000),
      completedAt: new Date(Date.now() - 3000000),
    },
  });

  // Demo pages
  const pages = [];
  const pagePaths = [
    '/', '/about', '/contact', '/blog', '/blog/post-1', '/blog/post-2',
    '/products', '/products/widget', '/products/gadget', '/pricing',
    '/docs', '/docs/getting-started', '/docs/api', '/team',
    '/careers', '/faq', '/terms', '/privacy', '/login', '/signup',
  ];

  for (const path of pagePaths) {
    const page = await prisma.page.upsert({
      where: { siteId_url: { siteId: site.id, url: `https://example.com${path}` } },
      create: {
        siteId: site.id,
        url: `https://example.com${path}`,
        path,
        title: `${path === '/' ? 'Home' : path.split('/').pop()?.replace(/-/g, ' ')} - Acme`,
        statusCode: 200,
        lastCrawledAt: new Date(),
      },
      update: {},
    });
    pages.push(page);
  }

  // Demo scan run
  const scanRun = await prisma.scanRun.create({
    data: {
      siteId: site.id,
      crawlRunId: crawlRun.id,
      status: 'COMPLETED',
      totalPages: pages.length,
      pagesScanned: pages.length,
      violationsFound: 47,
      startedAt: new Date(Date.now() - 2800000),
      completedAt: new Date(Date.now() - 2400000),
    },
  });

  // Demo findings
  const findingsData = [
    {
      ruleId: 'image-alt',
      impact: 'CRITICAL' as const,
      description: 'Images must have alternate text',
      wcagTags: ['wcag111'],
      selector: 'header > div > img.logo',
      html: '<img class="logo" src="/logo.png">',
      pageIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    {
      ruleId: 'button-name',
      impact: 'CRITICAL' as const,
      description: 'Buttons must have discernible text',
      wcagTags: ['wcag412'],
      selector: 'nav > button.menu-toggle',
      html: '<button class="menu-toggle"><svg>...</svg></button>',
      pageIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
    {
      ruleId: 'color-contrast',
      impact: 'SERIOUS' as const,
      description: 'Elements must have sufficient color contrast',
      wcagTags: ['wcag143'],
      selector: 'footer > p.copyright',
      html: '<p class="copyright" style="color: #999">Copyright 2024</p>',
      pageIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    },
    {
      ruleId: 'link-name',
      impact: 'SERIOUS' as const,
      description: 'Links must have discernible text',
      wcagTags: ['wcag412', 'wcag244'],
      selector: 'div.social > a',
      html: '<a href="https://twitter.com/acme"><svg>...</svg></a>',
      pageIndices: [0, 1, 2],
    },
    {
      ruleId: 'heading-order',
      impact: 'MODERATE' as const,
      description: 'Heading levels should only increase by one',
      wcagTags: ['wcag131'],
      selector: 'main > section > h4',
      html: '<h4>Product Features</h4>',
      pageIndices: [6, 7, 8],
    },
    {
      ruleId: 'label',
      impact: 'CRITICAL' as const,
      description: 'Form elements must have labels',
      wcagTags: ['wcag131', 'wcag332'],
      selector: 'form > input[type="email"]',
      html: '<input type="email" name="email" placeholder="Enter email">',
      pageIndices: [2, 18, 19],
    },
  ];

  for (const fd of findingsData) {
    const fingerprint = createHash('sha256')
      .update(`${site.id}|${fd.ruleId}|${fd.selector}`)
      .digest('hex')
      .slice(0, 32);

    const finding = await prisma.canonicalFinding.upsert({
      where: { fingerprint },
      create: {
        siteId: site.id,
        ruleId: fd.ruleId,
        impact: fd.impact,
        description: fd.description,
        wcagTags: fd.wcagTags,
        fingerprint,
        evidenceSource: 'AUTOMATED_AXE',
        status: 'OPEN',
        occurrenceCount: fd.pageIndices.length,
        lastScanRunId: scanRun.id,
        lastVerifiedAt: scanRun.completedAt ?? new Date(),
      },
      update: {
        occurrenceCount: fd.pageIndices.length,
        lastScanRunId: scanRun.id,
        lastVerifiedAt: scanRun.completedAt ?? new Date(),
      },
    });

    for (const idx of fd.pageIndices) {
      const page = pages[idx];
      if (!page) continue;

      const raw = await prisma.rawViolation.create({
        data: {
          scanRunId: scanRun.id,
          pageId: page.id,
          ruleId: fd.ruleId,
          impact: fd.impact,
          description: fd.description,
          wcagTags: fd.wcagTags,
          selector: fd.selector,
          elementHtml: fd.html,
          elementContext: `Demo failure context for ${fd.ruleId} on ${page.path}`,
          fingerprint,
        },
      });

      await prisma.findingOccurrence.upsert({
        where: {
          canonicalFindingId_pageId: { canonicalFindingId: finding.id, pageId: page.id },
        },
        create: {
          canonicalFindingId: finding.id,
          pageId: page.id,
          selector: fd.selector,
          elementHtml: fd.html,
          lastRawViolationId: raw.id,
        },
        update: {
          lastRawViolationId: raw.id,
        },
      });
    }
  }

  // Demo clusters
  const imageCluster = await prisma.issueCluster.create({
    data: {
      siteId: site.id,
      name: 'Missing alt text on header logo (13 pages)',
      description: 'Header logo image lacks alt text across all pages with the shared header component.',
      selectorPattern: 'header > div > img.logo',
      domFingerprint: 'img[class=logo]',
      pageCount: 13,
      findingCount: 1,
      severity: 'CRITICAL',
    },
  });

  const buttonCluster = await prisma.issueCluster.create({
    data: {
      siteId: site.id,
      name: 'Menu toggle button without accessible name (10 pages)',
      description: 'Mobile menu toggle button has an SVG icon but no accessible name.',
      selectorPattern: 'nav > button.menu-toggle',
      domFingerprint: 'button>svg',
      pageCount: 10,
      findingCount: 1,
      severity: 'CRITICAL',
    },
  });

  // Link findings to clusters
  const allFindings = await prisma.canonicalFinding.findMany({ where: { siteId: site.id } });
  for (const f of allFindings) {
    if (f.ruleId === 'image-alt') {
      await prisma.canonicalFinding.update({
        where: { id: f.id },
        data: { clusterId: imageCluster.id },
      });
    } else if (f.ruleId === 'button-name') {
      await prisma.canonicalFinding.update({
        where: { id: f.id },
        data: { clusterId: buttonCluster.id },
      });
    }
  }

  // Demo remediation suggestions
  await prisma.remediationSuggestion.create({
    data: {
      canonicalFindingId: allFindings.find((f) => f.ruleId === 'image-alt')?.id,
      clusterId: imageCluster.id,
      type: 'ALT_TEXT',
      status: 'VALIDATED',
      originalCode: '<img class="logo" src="/logo.png">',
      suggestedCode: '<img class="logo" src="/logo.png" alt="Acme Corp logo">',
      rationale: 'The header logo image is missing alt text. Added descriptive alt text identifying the company logo. Since this is a meaningful image (not decorative), it should convey the brand identity.',
      confidence: 0.85,
      validationResult: { valid: true, errors: [], warnings: [] },
    },
  });

  await prisma.remediationSuggestion.create({
    data: {
      canonicalFindingId: allFindings.find((f) => f.ruleId === 'button-name')?.id,
      clusterId: buttonCluster.id,
      type: 'BUTTON_LABEL',
      status: 'VALIDATED',
      originalCode: '<button class="menu-toggle"><svg>...</svg></button>',
      suggestedCode: '<button class="menu-toggle" aria-label="Open navigation menu"><svg aria-hidden="true">...</svg></button>',
      rationale: 'The menu toggle button uses an SVG icon without any accessible name. Added aria-label to provide screen reader users with context. Also added aria-hidden to the decorative SVG. Consider also adding visible text like "Menu" alongside the icon for maximum accessibility.',
      confidence: 0.75,
      validationResult: { valid: true, errors: [], warnings: [] },
    },
  });

  await prisma.remediationSuggestion.create({
    data: {
      canonicalFindingId: allFindings.find((f) => f.ruleId === 'label')?.id,
      type: 'FORM_LABEL',
      status: 'DRAFT',
      originalCode: '<input type="email" name="email" placeholder="Enter email">',
      suggestedCode: '<label for="email">Email address</label>\n<input type="email" name="email" id="email" placeholder="Enter email">',
      rationale: 'The email input relies on placeholder text as its only label. Placeholders disappear when users type and are not announced by all screen readers. Added a visible <label> element, which is the preferred approach over aria-label.',
      confidence: 0.9,
      validationResult: { valid: true, errors: [], warnings: [] },
    },
  });

  // Demo review tasks
  await prisma.reviewTask.create({
    data: {
      type: 'ALT_TEXT_REVIEW',
      status: 'PENDING',
      title: 'Review alt text for product images',
      description: 'Product images on /products/* pages need human-reviewed alt text that accurately describes the products.',
      assigneeId: user.id,
    },
  });

  await prisma.reviewTask.create({
    data: {
      type: 'KEYBOARD_FLOW',
      status: 'PENDING',
      title: 'Verify keyboard navigation on main menu',
      description: 'The main navigation menu needs keyboard flow verification - tab order, focus management, and escape behavior.',
    },
  });

  await prisma.reviewTask.create({
    data: {
      type: 'SCREEN_READER',
      status: 'IN_PROGRESS',
      title: 'Screen reader testing: checkout flow',
      description: 'Manual screen reader testing needed for the checkout flow to verify form instructions and error messages are announced.',
      assigneeId: user.id,
    },
  });

  // Audit log entries
  await prisma.auditLog.createMany({
    data: [
      { organizationId: org.id, userId: user.id, action: 'org.created', entityType: 'Organization', entityId: org.id },
      { organizationId: org.id, userId: user.id, action: 'site.created', entityType: 'Site', entityId: site.id },
      { organizationId: org.id, userId: user.id, action: 'crawl.started', entityType: 'CrawlRun', entityId: crawlRun.id },
      { organizationId: org.id, userId: user.id, action: 'crawl.completed', entityType: 'CrawlRun', entityId: crawlRun.id },
      { organizationId: org.id, userId: user.id, action: 'scan.completed', entityType: 'ScanRun', entityId: scanRun.id },
    ],
  });

  console.log('Seed complete!');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Email: demo@aros.dev');
  console.log('  Password: demo1234');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
