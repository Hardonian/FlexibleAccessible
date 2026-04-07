-- Allow passwordless OIDC (enterprise SSO) users and link IdP subjects.
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN "oidcIssuer" TEXT;
ALTER TABLE "users" ADD COLUMN "oidcSubject" TEXT;

CREATE UNIQUE INDEX "users_oidc_issuer_subject_key" ON "users"("oidcIssuer", "oidcSubject");
