import { prisma } from './db';
import { requireSession, type SessionUser } from './session';
import { hasPermission, type Permission } from '@aros/config';
import { ApiError } from '@aros/shared';
import type {
  MemberRole,
  PlanTier,
  SubscriptionStatus,
} from '@aros/db';

export interface OrgSubscriptionSnapshot {
  plan: PlanTier;
  status: SubscriptionStatus;
  maxDomains: number;
  maxPagesPerCrawl: number;
  maxScansPerMonth: number;
  maxSeats: number;
  aiEnabled: boolean;
  aiTokenLimit: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface EntitlementState {
  hasPaidAccess: boolean;
  reason:
    | 'active_paid'
    | 'free_plan'
    | 'past_due'
    | 'cancelled'
    | 'missing_subscription';
}

export interface AuthContext {
  user: SessionUser;
  organizationId: string;
  role: MemberRole;
  subscription: OrgSubscriptionSnapshot | null;
  entitlement: EntitlementState;
}

interface AccessOptions {
  requirePaid?: boolean;
}

function toSubscriptionSnapshot(
  subscription:
    | {
        plan: PlanTier;
        status: SubscriptionStatus;
        maxDomains: number;
        maxPagesPerCrawl: number;
        maxScansPerMonth: number;
        maxSeats: number;
        aiEnabled: boolean;
        aiTokenLimit: number;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd: boolean;
      }
    | null
    | undefined,
): OrgSubscriptionSnapshot | null {
  if (!subscription) return null;

  return {
    plan: subscription.plan,
    status: subscription.status,
    maxDomains: subscription.maxDomains,
    maxPagesPerCrawl: subscription.maxPagesPerCrawl,
    maxScansPerMonth: subscription.maxScansPerMonth,
    maxSeats: subscription.maxSeats,
    aiEnabled: subscription.aiEnabled,
    aiTokenLimit: subscription.aiTokenLimit,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
}

export function getEntitlementState(
  subscription: OrgSubscriptionSnapshot | null | undefined,
): EntitlementState {
  if (!subscription) {
    return { hasPaidAccess: false, reason: 'missing_subscription' };
  }

  if (subscription.plan === 'FREE') {
    return { hasPaidAccess: false, reason: 'free_plan' };
  }

  if (subscription.status === 'PAST_DUE') {
    return { hasPaidAccess: false, reason: 'past_due' };
  }

  if (subscription.status === 'CANCELLED') {
    return { hasPaidAccess: false, reason: 'cancelled' };
  }

  // TRIALING and ACTIVE both carry paid plan limits until Stripe moves the subscription.
  return { hasPaidAccess: true, reason: 'active_paid' };
}

export function entitlementReasonMessage(state: EntitlementState): string {
  switch (state.reason) {
    case 'free_plan':
      return 'This feature is available on paid plans only.';
    case 'past_due':
      return 'Your subscription is past due. Update billing to restore paid access.';
    case 'cancelled':
      return 'Your subscription has ended. Upgrade to restore paid access.';
    case 'missing_subscription':
      return 'No subscription was found for this organization.';
    case 'active_paid':
    default:
      return 'Premium access is available.';
  }
}

/**
 * Extra context for paywalls and billing (Stripe state semantics, grace expectations).
 * Safe to show next to EntitlementWall; does not replace entitlementReasonMessage.
 */
export function entitlementRecoveryHints(
  state: EntitlementState,
  subscription: OrgSubscriptionSnapshot | null | undefined,
): string[] {
  const hints: string[] = [];

  if (state.reason === 'past_due') {
    hints.push(
      'While past due, Stripe may still retry the payment on its schedule. Private routes stay locked until the subscription status returns to active or trialing.',
    );
    hints.push(
      'Use “Manage billing in Stripe” below (or your portal link) to update the payment method.',
    );
  }

  if (state.reason === 'cancelled') {
    hints.push(
      'Cancelled subscriptions keep this billing page readable so you can re-subscribe; historical private data stays locked until you are on an active paid status again.',
    );
  }

  if (state.reason === 'free_plan') {
    hints.push(
      'The free tier includes the public instant scan only. Private workspaces, exports, automation, and collaboration require an active paid subscription.',
    );
  }

  if (state.reason === 'missing_subscription') {
    hints.push(
      'If you recently completed checkout, wait for the Stripe webhook to confirm—then refresh. If this persists, contact support with your organization name.',
    );
  }

  if (state.hasPaidAccess && subscription?.status === 'TRIALING') {
    hints.push(
      'Trial (trialing) status carries the same paid workspace routes as an active subscription until Stripe moves the subscription.',
    );
  }

  return hints;
}

export function isBillingAccessiblePath(pathname: string): boolean {
  return (
    pathname === '/settings' ||
    pathname.startsWith('/settings/billing') ||
    pathname === '/verify-email'
  );
}

export async function requireOrgAccess(
  organizationId: string,
  requiredPermission?: Permission,
  options: AccessOptions = {},
): Promise<AuthContext> {
  const user = await requireSession();

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId,
      },
    },
    include: {
      organization: {
        select: {
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
    },
  });

  if (!membership) {
    throw ApiError.forbidden('You do not have access to this organization');
  }

  if (requiredPermission && !hasPermission(membership.role, requiredPermission)) {
    throw ApiError.forbidden(`Missing permission: ${requiredPermission}`);
  }

  const subscription = toSubscriptionSnapshot(membership.organization.subscription);
  const entitlement = getEntitlementState(subscription);

  if (options.requirePaid && !entitlement.hasPaidAccess) {
    throw new ApiError(
      entitlementReasonMessage(entitlement),
      'SUBSCRIPTION_REQUIRED',
      403,
      { entitlement, organizationId },
    );
  }

  return {
    user,
    organizationId,
    role: membership.role,
    subscription,
    entitlement,
  };
}

export async function requireSiteAccess(
  siteId: string,
  requiredPermission?: Permission,
  options: AccessOptions = {},
): Promise<AuthContext & { siteId: string; workspaceId: string }> {
  const user = await requireSession();

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      workspace: {
        include: {
          organization: {
            include: {
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
              memberships: {
                where: { userId: user.id },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!site || site.workspace.organization.memberships.length === 0) {
    throw ApiError.notFound('Site not found');
  }

  const membership = site.workspace.organization.memberships[0];
  if (requiredPermission && !hasPermission(membership.role, requiredPermission)) {
    throw ApiError.forbidden(`Missing permission: ${requiredPermission}`);
  }

  const subscription = toSubscriptionSnapshot(site.workspace.organization.subscription);
  const entitlement = getEntitlementState(subscription);

  if (options.requirePaid && !entitlement.hasPaidAccess) {
    throw new ApiError(
      entitlementReasonMessage(entitlement),
      'SUBSCRIPTION_REQUIRED',
      403,
      { entitlement, organizationId: site.workspace.organizationId },
    );
  }

  return {
    user,
    organizationId: site.workspace.organizationId,
    role: membership.role,
    subscription,
    entitlement,
    siteId: site.id,
    workspaceId: site.workspaceId,
  };
}
