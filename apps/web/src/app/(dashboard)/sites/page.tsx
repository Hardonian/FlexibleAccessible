import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import Link from 'next/link';

export const metadata = { title: 'Sites - AROS' };

export default async function SitesPage() {
  const user = await requireSession();

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  });

  if (!membership) return null;

  const sites = await prisma.site.findMany({
    where: { workspace: { organizationId: membership.organizationId } },
    include: {
      workspace: { select: { name: true } },
      _count: {
        select: {
          crawlRuns: true,
          pages: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sites</h1>
          <p className="text-slate-500 mt-1">Manage your monitored websites</p>
        </div>
        <Link href="/sites/new" className="btn-primary">
          Add Site
        </Link>
      </div>

      {sites.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="text-lg font-medium text-slate-900">No sites yet</h3>
          <p className="text-slate-500 mt-2">
            Add your first website to start scanning for accessibility issues.
          </p>
          <Link href="/sites/new" className="btn-primary mt-4 inline-flex">
            Add Your First Site
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/sites/${site.id}`}
              className="card hover:shadow-md transition-shadow flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-slate-900">{site.name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{site.domain}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                  <span>{site.workspace.name}</span>
                  <span>{site.environment.toLowerCase()}</span>
                </div>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p>{site._count.pages} pages</p>
                <p>{site._count.crawlRuns} crawls</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
