import type { PrismaClient } from '@aros/db';

const PLATFORM_ID = 'platform';

export async function recordWorkerHeartbeat(prisma: PrismaClient): Promise<void> {
  await prisma.platformState.upsert({
    where: { id: PLATFORM_ID },
    create: {
      id: PLATFORM_ID,
      bootstrapVersion: 1,
      workerLastHeartbeatAt: new Date(),
    },
    update: { workerLastHeartbeatAt: new Date() },
  });
}
