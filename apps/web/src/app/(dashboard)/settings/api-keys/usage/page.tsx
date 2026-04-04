import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@aros/config";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { EntitlementWall } from "@/components/monetization/entitlement-wall";
import { getEntitlementState } from "@/lib/auth-guard";
import { getOrgUsageSummary, checkQuotaThreshold } from "@/lib/mcp-billing";
import { UsageDashboard } from "./usage-dashboard";

export const metadata = { title: "API Usage - AROS" };

type TimeRange = "7" | "30" | "90";

interface PageProps {
  searchParams: Promise<{
    days?: string;
  }>;
}

function getDaysFromSearchParams(days: string | undefined): number {
  const parsed = parseInt(days ?? "30", 10);
  if ([7, 30, 90].includes(parsed)) return parsed;
  return 30;
}

export default async function UsagePage({ searchParams }: PageProps) {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const params = await searchParams;
  const days = getDaysFromSearchParams(params.days);

  let canViewSystem = false;
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      select: { role: true },
    });
    canViewSystem = memberships.some((m) =>
      hasPermission(m.role, "org:system:view"),
    );
  } catch (error) {
    console.warn("[usage page] Failed to check system permissions", {
      userId: user.id,
      error,
    });
  }

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind === "platform_blocked") {
    return (
      <div className="space-y-6 max-w-6xl">
        <h1 className="text-2xl font-bold text-slate-900">API Usage</h1>
        <RouteReliabilityNotice
          variant="error"
          title="API Usage requires a working database"
          showSystemLink={canViewSystem}
        >
          <p>
            Usage analytics cannot be loaded until core data services are
            healthy.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6 max-w-6xl">
        <h1 className="text-2xl font-bold text-slate-900">API Usage</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Could not verify organization"
          showSystemLink={canViewSystem}
        >
          <p>{orgRes.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "none") {
    return (
      <div className="space-y-6 max-w-6xl">
        <h1 className="text-2xl font-bold text-slate-900">API Usage</h1>
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need an organization to view API usage.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const result = await runOrgScopedQuery(orgRes, async (organizationId) => {
    const [membership, apiKeys] = await Promise.all([
      prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId,
          },
        },
        include: {
          organization: {
            include: {
              subscription: true,
            },
          },
        },
      }),
      prisma.apiKey.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true },
      }),
    ]);

    const [usageSummary, quotaStatus] = await Promise.all([
      getOrgUsageSummary(organizationId, days),
      checkQuotaThreshold(organizationId),
    ]);

    return { membership, apiKeys, usageSummary, quotaStatus };
  });

  if (!result.ok || !result.data?.membership) {
    return (
      <div className="space-y-6 max-w-6xl">
        <h1 className="text-2xl font-bold text-slate-900">API Usage</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Could not load usage data"
          showSystemLink={canViewSystem}
        >
          <p>
            {result.ok ? "Usage data could not be loaded." : result.message}
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const { membership, apiKeys, usageSummary, quotaStatus } = result.data;
  const { organizationId, role } = orgRes;
  const subscription = membership.organization.subscription;
  const entitlement = getEntitlementState(subscription);
  const canViewUsage = hasPermission(role, "integrations:view");

  // Build a map of API key IDs to names for display
  const apiKeyNames = new Map(apiKeys.map((k) => [k.id, k.name]));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">API Usage</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor MCP API usage, costs, and quota for your organization.
          </p>
        </div>
      </div>

      {!entitlement.hasPaidAccess ? (
        <EntitlementWall
          subscription={subscription}
          entitlement={entitlement}
          title="API usage requires a paid plan"
          description="API usage analytics are available on paid plans only. Upgrade to view detailed usage metrics."
        />
      ) : !canViewUsage ? (
        <div className="card">
          <div className="flex items-center gap-3 text-slate-600">
            <p className="text-sm">
              API usage viewing is restricted to organization members with
              appropriate permissions.
            </p>
          </div>
        </div>
      ) : (
        <UsageDashboard
          organizationId={organizationId}
          initialDays={days}
          usageSummary={usageSummary}
          quotaStatus={quotaStatus}
          apiKeyNames={Object.fromEntries(apiKeyNames)}
        />
      )}
    </div>
  );
}
