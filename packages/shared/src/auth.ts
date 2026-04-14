/**
 * Auth Layer Types
 *
 * Standardized authentication and authorization patterns.
 * Four-layer security: auth -> authz -> feature gate -> control safety
 */

import type { StandardResult } from './result';

// ==================== LAYER 1: AUTHENTICATION ====================

/**
 * Authenticated user session
 */
export interface AuthenticatedUser {
  id: string;
  email?: string;
  sessionId: string;
  authenticatedAt: string;
  mfaVerified: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Authentication result
 */
export type AuthenticationResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; error: 'unauthenticated' | 'expired' | 'invalid' | 'mfa_required' };

/**
 * Authentication context
 */
export interface AuthContext {
  request: Request;
  headers: Headers;
  cookies?: Record<string, string>;
  ip?: string;
  userAgent?: string;
}

/**
 * Authenticate a request
 */
export async function authenticate(
  context: AuthContext,
  opts?: { requireMfa?: boolean }
): Promise<AuthenticationResult> {
  // Implementation depends on auth provider (Supabase, NextAuth, etc.)
  // This is a placeholder interface
  return { ok: false, error: 'unauthenticated' };
}

// ==================== LAYER 2: AUTHORIZATION (RBAC) ====================

/**
 * Permission types
 */
export type Permission =
  | 'read'
  | 'write'
  | 'create'
  | 'update'
  | 'delete'
  | 'admin'
  | 'execute'
  | 'invite'
  | 'billing'
  | 'audit';

/**
 * Resource types
 */
export type ResourceType =
  | 'workspace'
  | 'tenant'
  | 'organization'
  | 'resource'
  | 'action'
  | 'evidence'
  | 'user'
  | 'billing'
  | 'integration'
  | 'audit_log';

/**
 * Role definitions
 */
export type UserRole =
  | 'owner'
  | 'admin'
  | 'member'
  | 'viewer'
  | 'billing_admin'
  | 'support';

/**
 * Resource being accessed
 */
export interface Resource {
  type: ResourceType;
  id: string;
  tenantId?: string;
  workspaceId?: string;
  organizationId?: string;
}

/**
 * Authorization check request
 */
export interface AuthorizationCheck {
  user: AuthenticatedUser;
  permission: Permission;
  resource: Resource;
  context?: Record<string, unknown>;
}

/**
 * Authorization grant (successful check)
 */
export interface Grant {
  user: AuthenticatedUser;
  permission: Permission;
  resource: Resource;
  grantedAt: string;
  expiresAt?: string;
  scope: string[];
}

/**
 * Authorization result
 */
export type AuthorizationResult =
  | { ok: true; grant: Grant }
  | { ok: false; error: 'forbidden' | 'tenant_mismatch' | 'not_member' | 'role_insufficient' };

/**
 * Check authorization
 */
export async function authorize(check: AuthorizationCheck): Promise<AuthorizationResult> {
  // Implementation depends on authz provider (RBAC, ABAC, etc.)
  // This is a placeholder interface
  return { ok: false, error: 'forbidden' };
}

/**
 * Role hierarchy (higher index = more permissions)
 */
export const ROLE_HIERARCHY: UserRole[] = [
  'viewer',
  'member',
  'admin',
  'owner',
];

/**
 * Check if role has required level
 */
export function hasRoleLevel(userRole: UserRole, requiredRole: UserRole): boolean {
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
  return userIndex >= requiredIndex;
}

/**
 * Default permission matrix
 */
export const DEFAULT_PERMISSION_MATRIX: Record<UserRole, Permission[]> = {
  owner: ['read', 'write', 'create', 'update', 'delete', 'admin', 'execute', 'invite', 'billing', 'audit'],
  admin: ['read', 'write', 'create', 'update', 'delete', 'execute', 'invite'],
  member: ['read', 'write', 'create', 'update'],
  viewer: ['read'],
  billing_admin: ['read', 'billing'],
  support: ['read'],
};

// ==================== LAYER 3: FEATURE GATING ====================

/**
 * Subscription tiers
 */
export type SubscriptionTier =
  | 'free'
  | 'starter'
  | 'professional'
  | 'enterprise'
  | 'unsubscribed'
  | 'subscribed_unpaid'
  | 'subscribed_paid';

/**
 * Tier hierarchy for comparisons
 */
export const TIER_HIERARCHY: SubscriptionTier[] = [
  'unsubscribed',
  'free',
  'subscribed_unpaid',
  'starter',
  'subscribed_paid',
  'professional',
  'enterprise',
];

/**
 * Feature gate check
 */
export interface FeatureGate {
  tier: SubscriptionTier;
  feature: string;
  limit?: number;
  currentUsage: number;
  remaining?: number;
  expiresAt?: string;
}

/**
 * Feature access result
 */
export type FeatureAccessResult =
  | { ok: true; gate: FeatureGate }
  | { ok: false; error: 'tier_too_low' | 'limit_exceeded' | 'feature_disabled' | 'expired' };

/**
 * Check feature access
 */
export async function checkFeatureAccess(
  user: AuthenticatedUser,
  feature: string,
  opts?: { tenantId?: string }
): Promise<FeatureAccessResult> {
  // Implementation depends on billing/subscription provider
  // This is a placeholder interface
  return { ok: false, error: 'feature_disabled' };
}

/**
 * Compare two tiers
 */
export function compareTiers(tierA: SubscriptionTier, tierB: SubscriptionTier): number {
  const indexA = TIER_HIERARCHY.indexOf(tierA);
  const indexB = TIER_HIERARCHY.indexOf(tierB);
  return indexA - indexB;
}

/**
 * Check if tier meets requirement
 */
export function tierMeetsRequirement(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return compareTiers(userTier, requiredTier) >= 0;
}

// ==================== LAYER 4: CONTROL SAFETY ====================

/**
 * Blast radius classification
 */
export type BlastRadiusClass = 'none' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Control action safety check
 */
export interface ControlSafetyCheck {
  action: string;
  actionType: string;
  blastRadius: BlastRadiusClass;
  proposedBy: string;
  targetResource: Resource;
  requiresApproval: boolean;
  approvers?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Approval policy
 */
export interface ApprovalPolicy {
  id: string;
  actionPattern: string; // regex or glob
  blastRadiusMin: BlastRadiusClass;
  requiredApprovals: number;
  approverRoles: UserRole[];
  requireSeparateActor: boolean; // SoD: proposer can't approve
  expiresAfterMinutes: number;
}

/**
 * Control safety result
 */
export type ControlSafetyResult =
  | { ok: true; canExecute: boolean; approvers: string[]; policyId?: string }
  | { ok: false; error: 'requires_approval' | 'sod_violation' | 'frozen' | 'insufficient_approvers' | 'unauthorized' };

/**
 * Check control safety
 */
export async function checkControlSafety(
  check: ControlSafetyCheck,
  policies: ApprovalPolicy[]
): Promise<ControlSafetyResult> {
  // Check if frozen
  const isFrozen = await isSystemFrozen();
  if (isFrozen) {
    return { ok: false, error: 'frozen' };
  }

  // Find matching policy
  const policy = policies.find(p =>
    check.blastRadius === p.blastRadiusMin ||
    blastRadiusIndex(check.blastRadius) >= blastRadiusIndex(p.blastRadiusMin)
  );

  if (!policy) {
    // No policy = can execute
    return { ok: true, canExecute: true, approvers: [] };
  }

  if (check.requiresApproval) {
    return {
      ok: true,
      canExecute: false,
      approvers: check.approvers ?? [],
      policyId: policy.id,
    };
  }

  // Check SoD
  if (policy.requireSeparateActor && check.approvers?.includes(check.proposedBy)) {
    return { ok: false, error: 'sod_violation' };
  }

  return { ok: true, canExecute: true, approvers: [], policyId: policy.id };
}

/**
 * Blast radius severity index
 */
function blastRadiusIndex(br: BlastRadiusClass): number {
  const index = ['none', 'low', 'medium', 'high', 'critical'].indexOf(br);
  return index >= 0 ? index : 0;
}

/**
 * Check if system is in frozen state
 */
async function isSystemFrozen(): Promise<boolean> {
  // Implementation depends on system state store
  return false;
}

// ==================== UNIFIED SECURITY MIDDLEWARE ====================

/**
 * Security check options
 */
export interface SecurityOptions {
  requireAuth?: boolean;
  permission?: Permission;
  resource?: Resource;
  feature?: string;
  controlSafety?: ControlSafetyCheck;
  requireMfa?: boolean;
}

/**
 * Security context (result of all checks)
 */
export interface SecurityContext {
  authenticated: boolean;
  user?: AuthenticatedUser;
  authorized: boolean;
  grant?: Grant;
  featureAccess?: FeatureGate;
  controlSafety?: ControlSafetyResult;
  traceId: string;
}

/**
 * Run full security check
 */
export async function runSecurityCheck(
  authContext: AuthContext,
  options: SecurityOptions
): Promise<StandardResult<SecurityContext>> {
  const traceId = generateTraceId();

  // Layer 1: Authentication
  if (options.requireAuth !== false) {
    const authResult = await authenticate(authContext, { requireMfa: options.requireMfa });
    if (!authResult.ok) {
      return {
        ok: false,
        state: 'unauthorized',
        error: { message: 'Authentication required', code: 'UNAUTHORIZED' },
        metadata: { traceId, timestamp: new Date().toISOString(), durationMs: 0 },
      };
    }

    // Layer 2: Authorization
    if (options.permission && options.resource) {
      const authzResult = await authorize({
        user: authResult.user,
        permission: options.permission,
        resource: options.resource,
      });

      if (!authzResult.ok) {
        return {
          ok: false,
          state: 'forbidden',
          error: { message: 'Permission denied', code: 'FORBIDDEN' },
          metadata: { traceId, timestamp: new Date().toISOString(), durationMs: 0 },
        };
      }

      // Layer 3: Feature gating
      if (options.feature) {
        const featureResult = await checkFeatureAccess(authResult.user, options.feature);
        if (!featureResult.ok) {
          return {
            ok: false,
            state: 'forbidden',
            error: { message: `Feature ${options.feature} not available`, code: 'FEATURE_UNAVAILABLE' },
            metadata: { traceId, timestamp: new Date().toISOString(), durationMs: 0 },
          };
        }
      }

      // Layer 4: Control safety
      if (options.controlSafety) {
        // Get policies from store (in-memory or database) — stub; no policy store in this lib
        const policies: ApprovalPolicy[] = [];
        const safetyResult = await checkControlSafety(options.controlSafety, policies);

        if (!safetyResult.ok) {
          return {
            ok: false,
            state: 'forbidden',
            error: { message: 'Control safety check failed', code: 'CONTROL_SAFETY' },
            metadata: { traceId, timestamp: new Date().toISOString(), durationMs: 0 },
          };
        }

        return {
          ok: true,
          state: 'success',
          data: {
            authenticated: true,
            user: authResult.user,
            authorized: true,
            grant: authzResult.grant,
            featureAccess: undefined, // Feature access map not implemented in this lib
            controlSafety: safetyResult,
            traceId,
          },
          metadata: { traceId, timestamp: new Date().toISOString(), durationMs: 0 },
        };
      }

      return {
        ok: true,
        state: 'success',
        data: {
          authenticated: true,
          user: authResult.user,
          authorized: true,
          grant: authzResult.grant,
          traceId,
        },
        metadata: { traceId, timestamp: new Date().toISOString(), durationMs: 0 },
      };
    }

    return {
      ok: true,
      state: 'success',
      data: {
        authenticated: true,
        user: authResult.user,
        authorized: false,
        traceId,
      },
      metadata: { traceId, timestamp: new Date().toISOString(), durationMs: 0 },
    };
  }

  // No auth required
  return {
    ok: true,
    state: 'success',
    data: {
      authenticated: false,
      authorized: false,
      traceId,
    },
    metadata: { traceId, timestamp: new Date().toISOString(), durationMs: 0 },
  };
}

/**
 * Generate trace ID
 */
function generateTraceId(): string {
  return `tr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== TENANT ISOLATION ====================

/**
 * Tenant isolation check
 */
export interface TenantIsolationCheck {
  user: AuthenticatedUser;
  resourceTenantId: string;
  action: Permission;
}

/**
 * Check tenant isolation
 */
export async function checkTenantIsolation(
  check: TenantIsolationCheck
): Promise<boolean> {
  // Implementation depends on tenant membership store
  // This is a placeholder interface
  return true;
}

/**
 * Require tenant membership
 */
export async function requireTenantMembership(
  user: AuthenticatedUser,
  tenantId: string
): Promise<void> {
  const isMember = await checkTenantIsolation({
    user,
    resourceTenantId: tenantId,
    action: 'read',
  });

  if (!isMember) {
    throw new Error('Not a member of this tenant');
  }
}

// ==================== UTILITY TYPES ====================

/**
 * Handler with security context
 */
export type SecureHandler<T> = (
  context: SecurityContext,
  ...args: unknown[]
) => Promise<T>;

/**
 * Middleware function type
 */
export type SecurityMiddleware = (
  context: AuthContext,
  next: () => Promise<Response>
) => Promise<Response>;
