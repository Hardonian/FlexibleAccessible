import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { hasPermission } from '@aros/config';
import { AutoScanAfterCrawlForm } from './auto-scan-form';

export async function generateMetadata({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } });
  return { title: site ? `${site.name} settings - AROS` : 'Site settings - AROS' };
}

export default async function SiteSettingsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await requireSession();

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      crawlConfig: true,
      workspace: {
        include: {
          organization: {
            include: {
              memberships: { where: { userId: user.id }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!site || site.workspace.organization.memberships.length === 0) {
    notFound();
  }

  const membership = site.workspace.organization.memberships[0];
  if (!hasPermission(membership.role, 'site:manage')) {
    notFound();
  }

  const autoScanAfterCrawl = site.crawlConfig?.autoScanAfterCrawl !== false;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Link href="/sites" className="hover:text-brand-600">
            Sites
          </Link>
          <span>/</span>
          <Link href={`/sites/${siteId}`} className="hover:text-brand-600">
            {site.name}
          </Link>
          <span>/</span>
          <span>Settings</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Crawl &amp; verification</h1>
        <p className="text-slate-500 mt-1 text-sm">Controls how this site is crawled and what happens next.</p>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">After crawl</h2>
        <AutoScanAfterCrawlForm siteId={siteId} initialEnabled={autoScanAfterCrawl} />
      </div>
    </div>
  );
}
