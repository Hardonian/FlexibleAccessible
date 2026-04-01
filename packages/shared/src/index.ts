export { hashPassword, verifyPassword, generateToken } from './auth.js';
export {
  createFingerprint,
  normalizeSelector,
  createDomFingerprint,
  selectorSimilarity,
} from './fingerprint.js';
export { slugify, truncate, pluralize } from './strings.js';
export { ApiError, AppError } from './errors.js';
export type { PaginatedResult, PaginationParams } from './pagination.js';
export { paginationSchema, buildPaginationMeta } from './pagination.js';
export { wcagCriteriaMap, getWcagLevel } from './wcag.js';
export { bullmqConnectionOptions, getRedisClient } from './redis-connection.js';
export { SCAN_QUEUE_NAME, getSharedScanQueue } from './scan-queue.js';
export const VISUAL_REVIEW_QUEUE_NAME = 'visual-review' as const;
export {
  FINDING_STATUSES,
  OPERATOR_ALLOWED_TRANSITIONS,
  canOperatorTransition,
  shouldReopenOnAutomatedDetection,
  deriveAutomationEvidenceFreshness,
  type FindingStatusValue,
  type AutomationEvidenceFreshness,
} from './finding-lifecycle.js';

export * from './ai-usage.js';
