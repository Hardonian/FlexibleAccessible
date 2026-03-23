export { hashPassword, verifyPassword, generateToken } from './auth';
export {
  createFingerprint,
  normalizeSelector,
  createDomFingerprint,
  selectorSimilarity,
} from './fingerprint';
export { slugify, truncate, pluralize } from './strings';
export { ApiError, AppError } from './errors';
export type { PaginatedResult, PaginationParams } from './pagination';
export { paginationSchema, buildPaginationMeta } from './pagination';
export { wcagCriteriaMap, getWcagLevel } from './wcag';
export { bullmqConnectionOptions } from './redis-connection';
export {
  FINDING_STATUSES,
  OPERATOR_ALLOWED_TRANSITIONS,
  canOperatorTransition,
  shouldReopenOnAutomatedDetection,
  deriveAutomationEvidenceFreshness,
  type FindingStatusValue,
  type AutomationEvidenceFreshness,
} from './finding-lifecycle';
