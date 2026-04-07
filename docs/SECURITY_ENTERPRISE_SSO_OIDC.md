# Enterprise SSO (OpenID Connect)

**Last updated:** 2026-04-07.

This deployment can authenticate users through **OIDC** (OAuth2 authorization code + `id_token`) alongside email/password. It is **optional** and **disabled** until environment variables are set.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OIDC_ISSUER` | Yes | IdP issuer URL (no trailing slash), e.g. `https://login.microsoftonline.com/{tenant}/v2.0` or Okta issuer. |
| `OIDC_CLIENT_ID` | Yes | Registered client id. |
| `OIDC_CLIENT_SECRET` | Yes | Client secret (server-side only). |
| `OIDC_REDIRECT_URI` | No | Defaults to `{getAppBaseUrl()}/api/auth/oidc/callback`. Must match the IdP app registration exactly. |
| `OIDC_EMAIL_DOMAIN` | No | If set, only emails ending in `@domain` may complete SSO. |
| `OIDC_JIT_SIGNUP` | No | `true` / `1` to create user + default FREE org on first login (mirrors self-serve signup). |
| `OIDC_LINK_EXISTING_EMAIL` | No | `true` / `1` to attach IdP `sub` to an existing user with the same email (does not remove password login). |

**State cookie signing** uses `NEXTAUTH_SECRET` (preferred) or `SESSION_SECRET` (must be ≥16 chars).

## Operator checklist

1. Register the app in the IdP with redirect URI = `…/api/auth/oidc/callback`.
2. Request scopes: `openid email profile` (email claim required in `id_token`).
3. Set `OIDC_JIT_SIGNUP=true` **or** pre-provision users and use `OIDC_LINK_EXISTING_EMAIL=true` (or both).
4. Test login from `/login` → **Continue with organization SSO**.

## Security notes

- `id_token` is verified with the IdP JWKS (`iss`, `aud`, `nonce`, `sub`).
- CSRF mitigated via signed state JWT in an httpOnly cookie plus `state`/`nonce` round-trip.
- Password login is **rejected** for users with `passwordHash` null (SSO-only accounts) with a clear error.

## Limitations (v1)

- Single IdP per deployment (one `OIDC_ISSUER`).
- No SAML bridge in-app (use an IdP that speaks OIDC or a SAML→OIDC gateway).
- SCIM / directory sync is out of scope for this route bundle.
