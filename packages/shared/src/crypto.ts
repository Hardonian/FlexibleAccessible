import { randomBytes, scrypt as scryptCallback } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback);

/**
 * Generates a cryptographically random URL-safe base64 token.
 * @param bytes Number of random bytes to generate (default: 32)
 */
export function generateToken(bytes?: number): string {
  return randomBytes(bytes ?? 32).toString('base64url');
}

/**
 * Hashes a password using scrypt.
 * Returns a string in the format: `scrypt:<salt-hex>:<derived-hex>`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

/**
 * Verifies a password against a scrypt hash.
 * Returns false for unknown hash formats.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash.startsWith('scrypt:')) {
    return false;
  }
  const parts = hash.split(':');
  if (parts.length !== 3) {
    return false;
  }
  const [, saltHex, derivedHex] = parts;
  try {
    const salt = Buffer.from(saltHex!, 'hex');
    const expected = Buffer.from(derivedHex!, 'hex');
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    if (derived.length !== expected.length) {
      return false;
    }
    // Constant-time comparison
    let diff = 0;
    for (let i = 0; i < derived.length; i++) {
      diff |= derived[i]! ^ expected[i]!;
    }
    return diff === 0;
  } catch {
    return false;
  }
}
