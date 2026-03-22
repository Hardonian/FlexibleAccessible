-- CreateTable
CREATE TABLE "platform_state" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bootstrapVersion" INTEGER NOT NULL DEFAULT 1,
    "workerLastHeartbeatAt" TIMESTAMP(3),
    "productFlags" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "platform_state_pkey" PRIMARY KEY ("id")
);
