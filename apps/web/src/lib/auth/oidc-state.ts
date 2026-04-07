import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SEC = 600;

function getSecret(): string {
  const raw =
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    "";
  if (raw.length < 16) {
    throw new Error("NEXTAUTH_SECRET or SESSION_SECRET required for OIDC state");
  }
  return raw;
}

export type OidcStatePayload = {
  nonce: string;
  returnTo: string;
  emailHint: string | null;
};

type WirePayload = OidcStatePayload & { exp: number };

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = 4 - (s.length % 4 || 4);
  const b64 = (s + "=".repeat(pad % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

export async function signOidcState(payload: OidcStatePayload): Promise<string> {
  const wire: WirePayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + TTL_SEC,
  };
  const body = b64url(Buffer.from(JSON.stringify(wire), "utf8"));
  const sig = createHmac("sha256", getSecret()).update(body).digest();
  const sigB64 = b64url(sig);
  return `${body}.${sigB64}`;
}

export async function verifyOidcState(token: string): Promise<OidcStatePayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sigB64] = parts;
  const expected = createHmac("sha256", getSecret()).update(body).digest();
  let sig: Buffer;
  try {
    sig = fromB64url(sigB64);
  } catch {
    return null;
  }
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    return null;
  }
  let wire: WirePayload;
  try {
    wire = JSON.parse(fromB64url(body).toString("utf8")) as WirePayload;
  } catch {
    return null;
  }
  if (typeof wire.exp !== "number" || wire.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  if (typeof wire.nonce !== "string" || !wire.nonce) return null;
  const returnTo = typeof wire.returnTo === "string" ? wire.returnTo : "/dashboard";
  const emailHint =
    typeof wire.emailHint === "string" ? wire.emailHint : null;
  return { nonce: wire.nonce, returnTo, emailHint };
}

/** HttpOnly cookie holding signed OIDC state until callback. */
export const OIDC_PENDING_COOKIE = "aros_oidc_pending";
export const OIDC_STATE_MAX_AGE_SEC = TTL_SEC;
