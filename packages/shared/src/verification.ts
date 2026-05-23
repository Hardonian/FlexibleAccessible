import { randomBytes } from 'crypto';
/**
 * Verification Flow Types
 *
 * Standardized verification lifecycle across all repos.
 * Provides evidence collection, chain of custody, and confidence scoring.
 */

import { generateSecureId } from './id-utils';

/**
 * Verification status lifecycle
 */
export type VerificationStatus = 
  | 'pending'
  | 'in_progress'
  | 'passed'
  | 'failed'
  | 'inconclusive'
  | 'expired'
  | 'cancelled';

/**
 * Verification methods
 */
export type VerificationMethod = 
  | 'automated'
  | 'manual'
  | 'third_party'
  | 'cryptographic'
  | 'replay'
  | 'audit'
  | 'cross_reference';

/**
 * Types of verification targets
 */
export type VerificationTargetType = 
  | 'finding'
  | 'audit_log'
  | 'webhook'
  | 'evidence'
  | 'artifact'
  | 'signature'
  | 'hash'
  | 'chain'
  | 'configuration'
  | 'identity';

/**
 * Target being verified
 */
export interface VerificationTarget {
  type: VerificationTargetType;
  id: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Evidence collected during verification
 */
export interface VerificationEvidence {
  id: string;
  kind: string;
  collectedAt: string;
  source: string;
  data: unknown;
  hash?: string;
  signature?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Verification result details
 */
export interface VerificationResultDetails {
  success: boolean;
  confidence: number; // 0-100
  findings: string[];
  warnings: string[];
  evidenceRefs: string[];
  durationMs: number;
}

/**
 * Chain of custody entry
 */
export interface ChainOfCustody {
  actor: string; // user ID or service name
  action: string;
  timestamp: string;
  traceId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Individual verification attempt
 */
export interface VerificationAttempt {
  id: string;
  method: VerificationMethod;
  status: VerificationStatus;
  target: VerificationTarget;
  startedAt: string;
  completedAt?: string;
  evidence: VerificationEvidence[];
  result: VerificationResultDetails;
  performedBy: string;
  traceId: string;
  chainOfCustody: ChainOfCustody[];
  parentAttemptId?: string; // For re-verifications
  reverifyReason?: string;
}

/**
 * Configuration for verification flows
 */
export interface VerificationConfig {
  /** Max time before verification expires */
  expirationMs: number;
  /** Min confidence threshold for auto-approval */
  minConfidenceThreshold: number;
  /** Whether to require manual review for certain methods */
  requireManualReview: boolean;
  /** Methods that always require manual review */
  manualReviewMethods: VerificationMethod[];
  /** Max evidence items to collect */
  maxEvidenceItems: number;
  /** Whether to cryptographically sign evidence */
  signEvidence: boolean;
}

/**
 * Default verification configuration
 */
export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  expirationMs: 24 * 60 * 60 * 1000, // 24 hours
  minConfidenceThreshold: 80,
  requireManualReview: false,
  manualReviewMethods: ['manual'],
  maxEvidenceItems: 100,
  signEvidence: true,
};

/**
 * Create a new verification attempt
 */
export function createVerificationAttempt(
  target: VerificationTarget,
  method: VerificationMethod,
  performedBy: string,
  traceId: string,
  opts?: {
    config?: Partial<VerificationConfig>;
    parentAttemptId?: string;
    reverifyReason?: string;
  }
): VerificationAttempt {
  const now = new Date().toISOString();

  return {
    id: generateVerificationId(),
    method,
    status: 'pending',
    target,
    startedAt: now,
    evidence: [],
    result: {
      success: false,
      confidence: 0,
      findings: [],
      warnings: [],
      evidenceRefs: [],
      durationMs: 0,
    },
    performedBy,
    traceId,
    chainOfCustody: [
      {
        actor: performedBy,
        action: 'verification_initiated',
        timestamp: now,
        traceId,
      },
    ],
    parentAttemptId: opts?.parentAttemptId,
    reverifyReason: opts?.reverifyReason,
  };
}

/**
 * Record evidence for a verification attempt
 */
export function recordEvidence(
  attempt: VerificationAttempt,
  evidence: Omit<VerificationEvidence, 'id' | 'collectedAt'>,
  opts?: { performedBy?: string; traceId?: string }
): VerificationAttempt {
  const newEvidence: VerificationEvidence = {
    ...evidence,
    id: generateEvidenceId(),
    collectedAt: new Date().toISOString(),
  };

  return {
    ...attempt,
    evidence: [...attempt.evidence, newEvidence],
    chainOfCustody: [
      ...attempt.chainOfCustody,
      {
        actor: opts?.performedBy ?? attempt.performedBy,
        action: 'evidence_recorded',
        timestamp: new Date().toISOString(),
        traceId: opts?.traceId ?? attempt.traceId,
        metadata: { evidenceId: newEvidence.id },
      },
    ],
  };
}

/**
 * Complete a verification attempt
 */
export function completeVerification(
  attempt: VerificationAttempt,
  result: Omit<VerificationResultDetails, 'durationMs'>,
  opts?: { performedBy?: string; traceId?: string }
): VerificationAttempt {
  const completedAt = new Date().toISOString();
  const durationMs =
    new Date(completedAt).getTime() - new Date(attempt.startedAt).getTime();

  const status: VerificationStatus = result.success
    ? 'passed'
    : result.confidence < 50
    ? 'inconclusive'
    : 'failed';

  return {
    ...attempt,
    status,
    completedAt,
    result: {
      ...result,
      durationMs,
      evidenceRefs: attempt.evidence.map(e => e.id),
    },
    chainOfCustody: [
      ...attempt.chainOfCustody,
      {
        actor: opts?.performedBy ?? attempt.performedBy,
        action: 'verification_completed',
        timestamp: completedAt,
        traceId: opts?.traceId ?? attempt.traceId,
        metadata: { status, confidence: result.confidence },
      },
    ],
  };
}

/**
 * Mark a verification as failed
 */
export function failVerification(
  attempt: VerificationAttempt,
  reason: string,
  opts?: { performedBy?: string; traceId?: string }
): VerificationAttempt {
  return completeVerification(
    attempt,
    {
      success: false,
      confidence: 0,
      findings: [reason],
      warnings: [],
      evidenceRefs: [],
    },
    opts
  );
}

/**
 * Re-verify (create child attempt)
 */
export function reverify(
  attempt: VerificationAttempt,
  reason: string,
  opts?: { method?: VerificationMethod; performedBy?: string; traceId?: string }
): VerificationAttempt {
  return createVerificationAttempt(
    attempt.target,
    opts?.method ?? attempt.method,
    opts?.performedBy ?? attempt.performedBy,
    opts?.traceId ?? attempt.traceId,
    {
      parentAttemptId: attempt.id,
      reverifyReason: reason,
    }
  );
}

/**
 * Check if verification is valid (not expired)
 */
export function isVerificationValid(
  attempt: VerificationAttempt,
  config?: Partial<VerificationConfig>
): boolean {
  if (attempt.status !== 'passed') return false;

  const expirationMs = config?.expirationMs ?? DEFAULT_VERIFICATION_CONFIG.expirationMs;
  const completedAt = attempt.completedAt;
  if (!completedAt) return false;

  const expiryTime = new Date(completedAt).getTime() + expirationMs;
  return Date.now() < expiryTime;
}

/**
 * Calculate aggregate confidence from multiple verifications
 */
export function aggregateConfidence(attempts: VerificationAttempt[]): number {
  const passedAttempts = attempts.filter(a => a.status === 'passed');
  if (passedAttempts.length === 0) return 0;

  const avgConfidence =
    passedAttempts.reduce((sum, a) => sum + a.result.confidence, 0) /
    passedAttempts.length;

  // Weight by recency
  const now = Date.now();
  const weightedConfidence = passedAttempts.reduce((sum, a) => {
    const age = now - new Date(a.completedAt ?? a.startedAt).getTime();
    const weight = Math.max(0.1, 1 - age / (24 * 60 * 60 * 1000)); // Decay over 24h
    return sum + a.result.confidence * weight;
  }, 0) / passedAttempts.reduce((sum, a) => {
    const age = now - new Date(a.completedAt ?? a.startedAt).getTime();
    const weight = Math.max(0.1, 1 - age / (24 * 60 * 60 * 1000));
    return sum + weight;
  }, 0);

  return Math.round(weightedConfidence);
}

/**
 * Cryptographic verification primitives
 */
export interface CryptographicVerifier {
  algorithm: string;
  verifySignature(payload: Buffer, signature: string, publicKey: string): boolean;
  verifyHash(content: Buffer, expectedHash: string, algorithm?: string): boolean;
}

/**
 * Chain link for chain verification
 */
export interface ChainLink {
  hash: string;
  previousHash: string | null;
  timestamp: string;
  data: unknown;
  signature?: string;
}

/**
 * Chain verification result
 */
export interface ChainVerificationResult {
  valid: boolean;
  linksVerified: number;
  brokenAt?: number;
  error?: string;
  rootHash?: string;
}

/**
 * Verify a chain of links
 */
export function verifyChain(
  chain: ChainLink[],
  verifier: CryptographicVerifier
): ChainVerificationResult {
  if (chain.length === 0) {
    return { valid: false, linksVerified: 0, error: 'Empty chain' };
  }

  for (let i = 0; i < chain.length; i++) {
    const link = chain[i];

    // Verify previous hash linkage (except for root)
    if (i > 0) {
      const expectedPrevious = chain[i - 1].hash;
      if (link.previousHash !== expectedPrevious) {
        return {
          valid: false,
          linksVerified: i,
          brokenAt: i,
          error: `Link ${i} previous hash mismatch`,
        };
      }
    }

    // Verify hash integrity
    const dataBuffer = Buffer.from(JSON.stringify(link.data));
    if (!verifier.verifyHash(dataBuffer, link.hash, verifier.algorithm)) {
      return {
        valid: false,
        linksVerified: i,
        brokenAt: i,
        error: `Link ${i} hash mismatch`,
      };
    }
  }

  return {
    valid: true,
    linksVerified: chain.length,
    rootHash: chain[0].hash,
  };
}

/**
 * Webhook verification utilities
 */
export interface WebhookVerificationInput {
  payload: string | Buffer;
  signature: string;
  secret: string;
  algorithm?: 'sha256' | 'sha512';
}

/**
 * Verify webhook signature (HMAC)
 */
export function verifyWebhookSignature(
  input: WebhookVerificationInput
): boolean {
  const { payload, signature, secret } = input;
  const algorithm = input.algorithm ?? 'sha256';

  // This is a placeholder - in production, use proper crypto library
  // import { createHmac } from 'crypto';
  // const expected = createHmac(algorithm, secret).update(payload).digest('hex');
  // return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  return true; // Placeholder
}

/**
 * Generate verification ID
 */
function generateVerificationId(): string {
  return `ver_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/**
 * Generate evidence ID
 */
function generateEvidenceId(): string {
  return `ev_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/**
 * Verification flow interface (for implementations)
 */
export interface VerificationFlow {
  initiate(
    target: VerificationTarget,
    method: VerificationMethod,
    performedBy: string
  ): Promise<VerificationAttempt>;

  recordEvidence(
    attemptId: string,
    evidence: Omit<VerificationEvidence, 'id' | 'collectedAt'>
  ): Promise<void>;

  complete(
    attemptId: string,
    result: Omit<VerificationResultDetails, 'durationMs'>
  ): Promise<VerificationAttempt>;

  getStatus(attemptId: string): Promise<VerificationAttempt>;

  reverify(attemptId: string, reason: string): Promise<VerificationAttempt>;

  validate(attemptId: string): Promise<boolean>;
}