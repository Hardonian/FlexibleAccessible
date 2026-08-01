import { requireSession } from "@/lib/session";
import { requireOrgAccess } from "@/lib/auth-guard";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { getOrgIdentitySnapshot } from "@/lib/org-auth-policy";
import { prisma } from "@/lib/db";
import {
  addVerifiedDomainAction,
  removeVerifiedDomainAction,
  updateIdentityPolicyAction,
} from "./actions";

export const metadata = { title: "Identity & access" };

export default async function IdentitySettingsPage() {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== "ok") {
    return (
      <div className="space-y-4 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">Identity &amp; access</h1>
        <RouteReliabilityNotice variant="error" title="Organization is unavailable">
          <p>Unable to resolve organization context for identity settings.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const orgId = orgRes.organizationId;
  const updateIdentityPolicyFormAction = async (formData: FormData) => {
    "use server";
    await updateIdentityPolicyAction({ success: false, error: null }, formData);
  };
  const addVerifiedDomainFormAction = async (formData: FormData) => {
    "use server";
    await addVerifiedDomainAction({ success: false, error: null }, formData);
  };
  try {
    await requireOrgAccess(orgId, "org:manage");
  } catch {
    return (
      <div className="space-y-4 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">Identity &amp; access</h1>
        <RouteReliabilityNotice variant="error" title="Admin access required">
          <p>Only organization administrators can view or change identity policy.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const [snapshot, recentSessions] = await Promise.all([
    getOrgIdentitySnapshot(orgId),
    prisma.session.findMany({
      where: {
        user: { memberships: { some: { organizationId: orgId } } },
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        user: { select: { email: true, oidcIssuer: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-900">Identity &amp; access</h1>
      <section className="card space-y-3" aria-live="polite">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-900">Enforcement status</p>
          <span className={`badge ${snapshot.enforcementState === "misconfigured" ? "bg-rose-100 text-rose-700" : snapshot.enforcementState === "restricted" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
            {snapshot.enforcementState}
          </span>
        </div>
        <p className="text-sm text-slate-600">{snapshot.statusSummary}</p>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Auth policy</h2>
        <form action={updateIdentityPolicyFormAction} className="space-y-4">
          <input type="hidden" name="organizationId" value={orgId} />
          <label className="block text-sm text-slate-700">
            Login mode
            <select name="loginMode" defaultValue={snapshot.policy.loginMode} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="PASSWORD_AND_SSO">Password and SSO</option>
              <option value="SSO_ONLY">SSO only (fail-closed)</option>
              <option value="PASSWORD_ONLY">Password only</option>
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            SSO configuration status
            <select name="ssoConfigStatus" defaultValue={snapshot.policy.ssoConfigStatus} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="DISABLED">Disabled</option>
              <option value="INCOMPLETE">Incomplete</option>
              <option value="CONFIGURED">Configured</option>
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-slate-700">IdP issuer URL<input name="ssoIssuerUrl" defaultValue={snapshot.policy.ssoIssuerUrl ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="block text-sm text-slate-700">SSO entrypoint<input name="ssoEntryPoint" defaultValue={snapshot.policy.ssoEntryPoint ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="block text-sm text-slate-700">Metadata URL<input name="ssoMetadataUrl" defaultValue={snapshot.policy.ssoMetadataUrl ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="block text-sm text-slate-700">SCIM base URL (optional)<input name="scimBaseUrl" defaultValue={snapshot.policy.scimBaseUrl ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="enforceVerifiedDomains" defaultChecked={snapshot.policy.enforceVerifiedDomains} /> Enforce verified email domains for invites and provisioning</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="allowJitProvisioning" defaultChecked={snapshot.policy.allowJitProvisioning} /> Allow JIT provisioning (only if domain checks pass)</label>
          <button className="btn-primary" type="submit">Save identity policy</button>
        </form>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Verified domains</h2>
        <form action={addVerifiedDomainFormAction} className="flex flex-col gap-3 md:flex-row md:items-end">
          <input type="hidden" name="organizationId" value={orgId} />
          <label className="block flex-1 text-sm text-slate-700">Domain<input name="domain" placeholder="example.com" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="flex items-center gap-2 text-sm text-slate-700 md:pb-2"><input type="checkbox" name="markVerified" defaultChecked /> Mark verified now</label>
          <button className="btn-secondary" type="submit">Add domain</button>
        </form>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {snapshot.verifiedDomains.length === 0 ? (
            <li className="p-3 text-sm text-slate-500">No verified domains yet.</li>
          ) : (
            snapshot.verifiedDomains.map((domain) => (
              <li key={domain.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{domain.domain}</p>
                  <p className="text-slate-500">{domain.verifiedAt ? `Verified ${domain.verifiedAt.toLocaleDateString()}` : "Unverified"}</p>
                </div>
                <form action={removeVerifiedDomainAction}>
                  <input type="hidden" name="organizationId" value={orgId} />
                  <input type="hidden" name="domainId" value={domain.id} />
                  <button className="text-sm font-medium text-rose-700 hover:underline">Remove</button>
                </form>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Recent sign-in provenance</h2>
        <ul className="space-y-2 text-sm">
          {recentSessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span className="text-slate-700">{s.user.email}</span>
              <span className="text-slate-500">{s.user.oidcIssuer ? "SSO/OIDC" : "Password"} · {s.createdAt.toLocaleString()}</span>
            </li>
          ))}
          {recentSessions.length === 0 ? <li className="text-slate-500">No recent sessions.</li> : null}
        </ul>
      </section>
    </div>
  );
}
