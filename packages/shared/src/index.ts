/**
 * @hardonian/shared
 * 
 * Standardized patterns across MEL, Settler, and FlexibleAccessible
 * 
 * - result: Type-safe error handling with StandardResult<T>
 * - posture: Health and degradation tracking with SystemPosture
 * - verification: Verification lifecycle with evidence collection
 * - auth: 4-layer security (auth -> authz -> feature -> safety)
 */

// Result types
export {
  type ResultState,
  type ErrorDetails,
  type ResultMetadata,
  type StandardResult,
  success,
  failure,
  isSuccess,
  isFailure,
  unwrap,
  unwrapOr,
  map,
  flatMap,
  ResultAsync,
  ResultStateHttpStatus,
  toHttpStatus,
} from './result';

// Posture types
export {
  type PostureLevel,
  type ComponentState,
  type ComponentPosture,
  type SystemPosture,
  type DegradationThresholds,
  type ComponentCriticality,
  type ComponentDefinition,
  type HealthScore,
  type ReadinessResult,
  DEFAULT_DEGRADATION_THRESHOLDS,
  buildComponentPosture,
  componentStateToLevel,
  aggregatePosture,
  calculateHealthScore,
  determineReadiness,
  degradedPosture,
  unhealthyPosture,
} from './posture';

// Verification types
export {
  type VerificationStatus,
  type VerificationMethod,
  type VerificationTargetType,
  type VerificationTarget,
  type VerificationEvidence,
  type VerificationResultDetails,
  type ChainOfCustody,
  type VerificationAttempt,
  type VerificationConfig,
  type CryptographicVerifier,
  type ChainLink,
  type ChainVerificationResult,
  type WebhookVerificationInput,
  type VerificationFlow,
  DEFAULT_VERIFICATION_CONFIG,
  createVerificationAttempt,
  recordEvidence,
  completeVerification,
  failVerification,
  reverify,
  isVerificationValid,
  aggregateConfidence,
  verifyChain,
  verifyWebhookSignature,
} from './verification';

// Auth types
export {
  type AuthenticatedUser,
  type AuthenticationResult,
  type AuthContext,
  authenticate,
  type Permission,
  type ResourceType,
  type UserRole,
  type Resource,
  type AuthorizationCheck,
  type Grant,
  type AuthorizationResult,
  authorize,
  ROLE_HIERARCHY,
  hasRoleLevel,
  DEFAULT_PERMISSION_MATRIX,
  type SubscriptionTier,
  TIER_HIERARCHY,
  type FeatureGate,
  type FeatureAccessResult,
  checkFeatureAccess,
  compareTiers,
  tierMeetsRequirement,
  type BlastRadiusClass,
  type ControlSafetyCheck,
  type ApprovalPolicy,
  type ControlSafetyResult,
  checkControlSafety,
  type SecurityOptions,
  type SecurityContext,
  runSecurityCheck,
  type TenantIsolationCheck,
  checkTenantIsolation,
  requireTenantMembership,
  type SecureHandler,
  type SecurityMiddleware,
} from './auth';

// Errors
export { AppError, ApiError } from './errors';

// Abuse rate limiting
export {
  type AbuseRateLimitMode,
  type AbuseRateLimitOutcome,
  abuseRateLimit,
} from './abuse-rate-limit';

// String utilities
export { slugify, truncate, pluralize } from './strings';

// Redis connection
export { bullmqConnectionOptions, getRedisClient } from './redis-connection';

// Scan queue
export {
  SCAN_QUEUE_NAME,
  VISUAL_REVIEW_QUEUE_NAME,
  getSharedScanQueue,
} from './scan-queue';

// Logger
export {
  LogLevel,
  type LogEntry,
  apiLogger,
  authLogger,
  billingLogger,
  scanLogger,
  workerLogger,
  dbLogger,
  createRequestLogger,
} from './logger';

// Finding lifecycle
export {
  FINDING_STATUSES,
  type FindingStatusValue,
  OPERATOR_ALLOWED_TRANSITIONS,
  canOperatorTransition,
  shouldReopenOnAutomatedDetection,
  type AutomationEvidenceFreshness,
  deriveAutomationEvidenceFreshness,
} from './finding-lifecycle';

// AI usage
export {
  type AiUsageDetails,
  logAiUsage,
  checkAiEntitlement,
} from './ai-usage';

// WCAG
export {
  type WcagLevel,
  wcagCriteriaMap,
  getWcagLevel,
} from './wcag';

// Pagination
export {
  type PaginationParams,
  type PaginatedResult,
  paginationSchema,
  buildPaginationMeta,
} from './pagination';

// Fingerprint
export {
  createFingerprint,
  normalizeSelector,
  createDomFingerprint,
  selectorSimilarity,
} from './fingerprint';

// Crypto
export { generateToken, hashPassword, verifyPassword } from './crypto';

// Version
export const VERSION = '1.0.0';

// Package metadata
export const PACKAGE_INFO = {
  name: '@hardonian/shared',
  version: VERSION,
  description: 'Standardized patterns across MEL, Settler, and FlexibleAccessible',
} as const;
