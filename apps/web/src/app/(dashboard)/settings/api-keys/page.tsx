import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Key } from "lucide-react";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { EntitlementWall } from "@/components/monetization/entitlement-wall";
import { hasPermission } from "@aros/config";
import { EmptyState } from "@aros/ui";
import { getEntitlementState } from "@/lib/auth-guard";
import { ApiKeysList } from "./api-keys-list";

export const metadata = { title: "API Keys - AROS" };

const VALID_SCOPES = [
  { id: "read", label: "Read", description: "Read-only access to data" },
  {
    id: "scan:write",
    label: "Scan: Write",
    description: "Start and manage scans",
  },
  {
    id: "crawl:write",
    label: "Crawl: Write",
    description: "Start and manage crawls",
  },
  {
    id: "remediation:write",
    label: "Remediation: Write",
    description: "Apply remediation suggestions",
  },
  {
    id: "reports:read",
    label: "Reports: Read",
    description: "View and export reports",
  },
];

function noticeFromSearchParams(
  searchParams: Awaited<PageProps["searchParams"]>,
) {
  if (searchParams.status === "revoked") {
    return {
      variant: "info" as const,
      title: "API key revoked",
      message: "The API key has been successfully revoked.",
    };
  }

  if (searchParams.error) {
    return {
      variant: "error" as const,
      title: "Action failed",
      message: searchParams.error,
    };
  }

  return null;
}

interface PageProps {
  searchParams: Promise<{
    status?: string;
    error?: string;
  }>;
}

export default async function ApiKeysPage({ searchParams }: PageProps) {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const params = await searchParams;
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
    console.warn("[api-keys page] Failed to check system permissions", {
      userId: user.id,
      error,
    });
  }

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);
  const notice = noticeFromSearchParams(params);

  if (orgRes.kind === "platform_blocked") {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
        <RouteReliabilityNotice
          variant="error"
          title="API Keys require a working database"
          showSystemLink={canViewSystem}
        >
          <p>
            API key management cannot be loaded until core data services are
            healthy.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
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
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need an organization to manage API keys.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const result = await runOrgScopedQuery(orgRes, async (organizationId) => {
    const [keys, membership] = await Promise.all([
      prisma.apiKey.findMany({
        where: {
          organizationId,
        },
        include: {
          mcpUsageLogs: {
            select: {
              id: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
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
    ]);

    return { keys, membership };
  });

  if (!result.ok || !result.data?.membership) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Could not load API keys"
          showSystemLink={canViewSystem}
        >
          <p>
            {result.ok
              ? "Organization data could not be loaded."
              : result.message}
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const { keys, membership } = result.data;
  const { organizationId, role } = orgRes;
  const subscription = membership.organization.subscription;
  const entitlement = getEntitlementState(subscription);
  const canManageApiKeys = hasPermission(role, "integrations:manage");

  // Check for keys expiring soon (within 7 days)
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiringSoonKeys = keys.filter(
    (key) =>
      key.expiresAt && key.expiresAt > now && key.expiresAt < sevenDaysFromNow,
  );

  const formattedKeys = keys.map((key) => ({
    id: key.id,
    name: key.name,
    scopes: key.scopes as string[],
    rateLimitPerMinute: key.rateLimitPerMinute,
    isActive: key.isActive,
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt,
    createdAt: key.createdAt,
    totalCalls: key.mcpUsageLogs.length,
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage API keys for programmatic access to the AROS platform.
          </p>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            notice.variant === "error"
              ? "border-red-200 bg-red-50 text-red-950"
              : "border-slate-200 bg-slate-50 text-slate-900"
          }`}
          role={notice.variant === "error" ? "alert" : "status"}
        >
          <p className="font-medium">{notice.title}</p>
          <p className="mt-1">{notice.message}</p>
        </div>
      )}

      {expiringSoonKeys.length > 0 && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">Keys expiring soon</p>
          <p className="mt-1">
            {expiringSoonKeys.length === 1
              ? `1 API key expires within 7 days.`
              : `${expiringSoonKeys.length} API keys expire within 7 days.`}{" "}
            Consider rotating them before they expire.
          </p>
        </div>
      )}

      {!entitlement.hasPaidAccess && (
        <EntitlementWall
          subscription={subscription}
          entitlement={entitlement}
          title="API keys require a paid plan"
          description="API key management is available on paid plans only. Upgrade to create and manage API keys."
        />
      )}

      {canManageApiKeys ? (
        <ApiKeysList
          organizationId={organizationId}
          initialKeys={formattedKeys}
          availableScopes={VALID_SCOPES}
          disabled={!entitlement.hasPaidAccess}
        />
      ) : (
        <div className="card">
          <div className="flex items-center gap-3 text-slate-600">
            <Key className="h-5 w-5" />
            <p className="text-sm">
              API key management is restricted to organization admins and
              owners.
            </p>
          </div>
          <div className="mt-4">
            <Link href="/settings" className="btn-secondary">
              Back to Settings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
