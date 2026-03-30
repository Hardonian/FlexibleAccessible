import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { DashboardNavProvider } from '@/components/layout/dashboard-nav-context';
import { MobileDashboardNav } from '@/components/layout/mobile-dashboard-nav';
import { hasPermission } from '@aros/config';
import type { Prisma } from '@aros/db';
import { getRoutePlatformTruth } from '@/lib/platform-truth-cache';
import { PlatformShellBanner } from '@/components/reliability/platform-shell-banner';
import { RouteReliabilityNotice } from '@/components/reliability/route-reliability-notice';

const membershipLayoutInclude = {
  organization: {
    include: {
      workspaces: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.MembershipInclude;

type LayoutMembership = Prisma.MembershipGetPayload<{ include: typeof membershipLayoutInclude }>;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect('/login');

  let memberships: LayoutMembership[] = [];
  let layoutDbError: string | null = null;
  try {
    memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: membershipLayoutInclude,
    });
  } catch (e) {
    layoutDbError = e instanceof Error ? e.message : 'Database error';
    console.error('[dashboard layout] membership load failed', e);
  }

  const orgs = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
    workspaces: m.organization.workspaces,
  }));

  const canViewSystem = memberships.some((m) => hasPermission(m.role, 'org:system:view'));

  let platformTruth: Awaited<ReturnType<typeof getRoutePlatformTruth>> | null = null;
  try {
    platformTruth = await getRoutePlatformTruth();
  } catch (e) {
    console.error('[dashboard layout] platform truth failed', e);
  }

  const shellAudience = canViewSystem ? 'operator' : 'user';

  return (
    <DashboardNavProvider>
      <div className="flex min-h-dvh overflow-hidden bg-slate-50 md:h-screen">
        <Sidebar orgs={orgs} user={user} canViewSystem={canViewSystem} />
        <MobileDashboardNav orgs={orgs} user={user} canViewSystem={canViewSystem} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TopBar user={user} platformTruth={platformTruth} canViewSystem={canViewSystem} />
          {platformTruth && (
            <PlatformShellBanner truth={platformTruth} audience={shellAudience} canViewSystem={canViewSystem} />
          )}
          <main className="flex-1 overflow-y-auto p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 md:p-6">
          {layoutDbError && (
            <RouteReliabilityNotice variant="error" title="Navigation data unavailable" showSystemLink={canViewSystem}>
              <p>
                Organization and workspace lists could not be loaded ({layoutDbError}). Pages that need organization
                context may not work until the database is reachable.
              </p>
            </RouteReliabilityNotice>
          )}
          {!layoutDbError && memberships.length === 0 && (
            <RouteReliabilityNotice variant="info" title="No organization membership">
              <p>
                You are signed in but not assigned to an organization. Ask an administrator to invite you, or contact
                support if you believe this is a mistake.
              </p>
            </RouteReliabilityNotice>
          )}
            {children}
          </main>
        </div>
      </div>
    </DashboardNavProvider>
  );
}
