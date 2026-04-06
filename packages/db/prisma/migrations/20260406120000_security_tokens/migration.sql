-- CreateEnum
CREATE TYPE "SecurityTokenKind" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

-- CreateTable
CREATE TABLE "security_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "SecurityTokenKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "security_tokens_tokenHash_key" ON "security_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "security_tokens_userId_kind_idx" ON "security_tokens"("userId", "kind");

-- CreateIndex
CREATE INDEX "security_tokens_expiresAt_idx" ON "security_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "security_tokens" ADD CONSTRAINT "security_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grandfather existing accounts: they were created before enforced verification.
UPDATE "users" SET "emailVerified" = true WHERE "emailVerified" = false;
