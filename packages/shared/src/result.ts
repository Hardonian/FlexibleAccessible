/**
 * Standardized Result Types
 *
 * Unified error handling pattern across all repos.
 * Provides type-safe discriminated unions with consistent metadata.
 */

/**
 * Standard result states that can occur across all operations
 */
export type ResultState = 
  | 'success'
  | 'validation_error'
  | 'not_found' 
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'degraded'
  | 'unavailable'
  | 'conflict'
  | 'internal_error';

/**
 * Error details for failed operations
 */
export interface ErrorDetails {
  message: string;
  code: string;
  details?: Record<string, unknown>;
}

/**
 * Metadata included in every result for observability
 */
export interface ResultMetadata {
  traceId: string;
  timestamp: string;
  durationMs: number;
  reasonCodes?: string[];
}

/**
 * Standard result type - discriminated union for type-safe error handling
 */
export interface StandardResult<T = void> {
  ok: boolean;
  state: ResultState;
  data?: T;
  error?: ErrorDetails;
  metadata: ResultMetadata;
}

/**
 * Create a successful result
 */
export function success<T>(
  data: T,
  metadata: Partial<ResultMetadata> & { traceId: string }
): StandardResult<T> {
  return {
    ok: true,
    state: 'success',
    data,
    metadata: {
      traceId: metadata.traceId,
      timestamp: metadata.timestamp ?? new Date().toISOString(),
      durationMs: metadata.durationMs ?? 0,
      reasonCodes: metadata.reasonCodes,
    },
  };
}

/**
 * Create a failed result
 */
export function failure(
  state: Exclude<ResultState, 'success'>,
  error: ErrorDetails,
  metadata: Partial<ResultMetadata> & { traceId: string }
): StandardResult<never> {
  return {
    ok: false,
    state,
    error,
    metadata: {
      traceId: metadata.traceId,
      timestamp: metadata.timestamp ?? new Date().toISOString(),
      durationMs: metadata.durationMs ?? 0,
      reasonCodes: metadata.reasonCodes,
    },
  };
}

/**
 * Check if a result is successful (type guard)
 */
export function isSuccess<T>(result: StandardResult<T>): result is StandardResult<T> & { ok: true; data: T } {
  return result.ok === true;
}

/**
 * Check if a result is a failure (type guard)
 */
export function isFailure<T>(result: StandardResult<T>): result is StandardResult<T> & { ok: false; error: ErrorDetails } {
  return result.ok === false;
}

/**
 * Unwrap a result - return data on success, throw on failure
 */
export function unwrap<T>(result: StandardResult<T>): T {
  if (isSuccess(result)) {
    return result.data;
  }
  throw new Error(result.error?.message ?? 'Operation failed');
}

/**
 * Unwrap a result with a default value on failure
 */
export function unwrapOr<T>(result: StandardResult<T>, defaultValue: T): T {
  if (isSuccess(result)) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Map a successful result to a new value
 */
export function map<T, U>(result: StandardResult<T>, fn: (data: T) => U): StandardResult<U> {
  if (isSuccess(result)) {
    return success(fn(result.data), result.metadata);
  }
  return result as unknown as StandardResult<U>;
}

/**
 * Flat map (chain) operations on results
 */
export function flatMap<T, U>(
  result: StandardResult<T>,
  fn: (data: T) => StandardResult<U>
): StandardResult<U> {
  if (isSuccess(result)) {
    return fn(result.data);
  }
  return result as unknown as StandardResult<U>;
}

/**
 * Result utilities for async operations
 */
export const ResultAsync = {
  /**
   * Wrap an async operation in a StandardResult
   */
  async tryCatch<T>(
    operation: () => Promise<T>,
    metadata: { traceId: string }
  ): Promise<StandardResult<T>> {
    const startTime = Date.now();
    try {
      const data = await operation();
      return success(data, {
        ...metadata,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      const error: ErrorDetails = {
        message: err instanceof Error ? err.message : String(err),
        code: 'OPERATION_FAILED',
      };
      return failure('internal_error', error, {
        ...metadata,
        durationMs: Date.now() - startTime,
      });
    }
  },

  /**
   * Execute multiple results in parallel, return all or first failure
   */
  async all<T extends Record<string, StandardResult<unknown>>>(
    results: T,
    metadata: { traceId: string }
  ): Promise<StandardResult<{ [K in keyof T]: T[K] extends StandardResult<infer U> ? U : never }>> {
    const entries = Object.entries(results);
    const failedEntry = entries.find(([, result]) => isFailure(result as StandardResult<unknown>));
    
    if (failedEntry) {
      return failedEntry[1] as StandardResult<never>;
    }

    const data = Object.fromEntries(
      entries.map(([key, result]) => [key, (result as StandardResult<unknown>).data])
    ) as { [K in keyof T]: T[K] extends StandardResult<infer U> ? U : never };

    return success(data, metadata);
  },
};

/**
 * HTTP status code mapping for ResultState
 */
export const ResultStateHttpStatus: Record<ResultState, number> = {
  success: 200,
  validation_error: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  degraded: 503,
  unavailable: 503,
  internal_error: 500,
};

/**
 * Convert a ResultState to an HTTP status code
 */
export function toHttpStatus(state: ResultState): number {
  return ResultStateHttpStatus[state];
}