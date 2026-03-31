import { scrypt, randomBytes, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

/**
 * Hash a password using scrypt with a random salt.
 * Format: scrypt$salt$hash (hex-encoded)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const hash = await scryptAsync(password, salt);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

/**
 * Verify a password against a stored hash.
 * Supports both legacy SHA-256 format (salt:hash) and new scrypt format.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");

  if (parts.length === 3 && parts[0] === "scrypt") {
    // New scrypt format
    const [, salt, hash] = parts;
    try {
      const candidate = await scryptAsync(password, salt);
      return timingSafeEqual(Buffer.from(hash!, "hex"), candidate);
    } catch {
      return false;
    }
  }

  // Legacy SHA-256 format (salt:hash) — backward compatible
  const legacyParts = stored.split(":");
  if (legacyParts.length === 2) {
    const { createHash } = await import("crypto");
    const [salt, hash] = legacyParts;
    if (!salt || !hash) return false;
    const candidate = createHash("sha256")
      .update(salt + password)
      .digest("hex");
    try {
      return timingSafeEqual(
        Buffer.from(hash, "hex"),
        Buffer.from(candidate, "hex"),
      );
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Generate a cryptographically secure random token.
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}
