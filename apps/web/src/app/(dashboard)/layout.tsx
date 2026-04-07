import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { DashboardNavProvider } from "@/components/layout/dashboard-nav-context";
import { MobileDashboardNav } from "@/components/layout/mobile-dashboard-nav";
import { hasPermission } from "@aros/config";
import type { Prisma } from "@aros/db";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { PlatformShellBanner } from "@/components/reliability/platform-shell-banner";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { getEntitlementState, isBillingAccessiblePath } from "@/lib/auth-guard";
import { isEmailVerificationExemptPath } from "@/lib/email-verification-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

const membershipLayoutInclude = {
  organization: {
    include: {
      workspaces: { select: { id: true, name: true, slug: true } },
      subscription: {
        select: {
          plan: true,
          status: true,
          maxDomains: true,
          maxPagesPerCrawl: true,
          maxScansPerMonth: true,
          maxSeats: true,
          aiEnabled: true,
          aiTokenLimit: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      },
    },
  },
} satisfies Prisma.MembershipInclude;

type LayoutMembership = Prisma.MembershipGetPayload<{
  include: typeof membershipLayoutInclude;
}>;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "/dashboard";
  if (!user.emailVerified && !isEmailVerificationExemptPath(pathname)) {
    redirect("/verify-email");
  }

  let memberships: LayoutMembership[] = [];
  let layoutDbError: string | null = null;
  try {
    memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: membershipLayoutInclude,
    });
  } catch (e) {
    layoutDbError = e instanceof Error ? e.message : "Database error";
    console.error("[dashboard layout] membership load failed", e);
  }

  const orgs = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
    workspaces: m.organization.workspaces,
    subscription: m.organization.subscription,
  }));

  const cookieStore = await cookies();
  const preferredOrgId = cookieStore.get("aros_active_org")?.value;
  const activeOrgId =
    preferredOrgId && orgs.some((o) => o.id === preferredOrgId)
      ? preferredOrgId
      : orgs[0]?.id;

  const canViewSystem = memberships.some((m) =>
    hasPermission(m.role, "org:system:view"),
  );

  let platformTruth: Awaited<ReturnType<typeof getRoutePlatformTruth>> | null =
    null;
  try {
    platformTruth = await getRoutePlatformTruth();
  } catch (e) {
    console.error("[dashboard layout] platform truth failed", e);
  }

  const shellAudience = canViewSystem ? "operator" : "user";

  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const entitlement = getEntitlementState(activeOrg?.subscription);
  const requiresPaidAccess = !isBillingAccessiblePath(pathname);

  if (
    !layoutDbError &&
    activeOrg &&
    requiresPaidAccess &&
    !entitlement.hasPaidAccess
  ) {
    redirect(
      `/settings/billing?status=upgrade_required&from=${encodeURIComponent(pathname)}`,
    );
  }

  let aiUsage:
    | { enabled: boolean; limit: number; used: number }
    | undefined = undefined;
  if (activeOrg) {
    const usage = await prisma.aiUsageLog.aggregate({
      where: { organizationId: activeOrg.id },
      _sum: { totalTokens: true },
    });
    aiUsage = {
      enabled: activeOrg.subscription?.aiEnabled ?? false,
      limit: activeOrg.subscription?.aiTokenLimit ?? 0,
      used: usage._sum.totalTokens ?? 0,
    };
  }

  return (
    <DashboardNavProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:rounded focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        Skip to main content
      </a>
      <div className="flex min-h-dvh overflow-hidden bg-[rgb(var(--color-app-canvas))] md:h-screen">
        <Sidebar
          orgs={orgs}
          user={user}
          canViewSystem={canViewSystem}
          hasPaidAccess={entitlement.hasPaidAccess}
          activeOrgId={activeOrgId}
          aiUsage={aiUsage}
        />
        <MobileDashboardNav
          orgs={orgs}
          user={user}
          canViewSystem={canViewSystem}
          hasPaidAccess={entitlement.hasPaidAccess}
          activeOrgId={activeOrgId}
          aiUsage={aiUsage}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TopBar
            user={user}
            organizationName={activeOrg?.name}
            platformTruth={platformTruth}
            canViewSystem={canViewSystem}
          />
          {platformTruth && (
            <PlatformShellBanner
              truth={platformTruth}
              audience={shellAudience}
              canViewSystem={canViewSystem}
            />
          )}
          <main
            id="main-content"
            className="flex-1 overflow-y-auto p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 md:p-6"
          >
            {layoutDbError && (
              <RouteReliabilityNotice
                variant="error"
                title="Navigation data unavailable"
                showSystemLink={canViewSystem}
              >
                <p>
                  Organization and workspace lists could not be loaded (
                  {layoutDbError}). Pages that need organization context may not
                  work until the database is reachable.
                </p>
              </RouteReliabilityNotice>
            )}
            {!layoutDbError && memberships.length === 0 && (
              <RouteReliabilityNotice
                variant="info"
                title="No organization membership"
              >
                <p>
                  You are signed in but not assigned to an organization. Ask an
                  administrator to invite you, or contact support if you believe
                  this is a mistake.
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
