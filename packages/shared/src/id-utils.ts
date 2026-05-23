import { randomBytes } from 'node:crypto';

/**
 * Generates a secure random ID with a prefix and timestamp.
 *
 * Format: {prefix}_{timestamp}_{random_hex}
 *
 * @param prefix - The prefix for the ID (e.g., 'chk', 'tr', 'ver')
 * @returns A secure unique ID string
 */
export function generateSecureId(prefix: string): string {
  const timestamp = Date.now();
  const randomness = randomBytes(6).toString('hex');
  return `${prefix}_${timestamp}_${randomness}`;
}
