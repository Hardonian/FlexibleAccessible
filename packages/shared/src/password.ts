import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Hash a plaintext password using scrypt with a random salt.
 * Output format: `<salt_hex>:<derived_key_hex>`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a plaintext password against a stored hash produced by hashPassword.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const storedKey = Buffer.from(keyHex, 'hex');
  const derivedKey = scryptSync(password, salt, 64);
  return timingSafeEqual(storedKey, derivedKey);
}

/**
 * Generate a cryptographically secure random hex token.
 * @param bytes - Number of random bytes (default 32 → 64 hex chars)
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
