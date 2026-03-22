import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const row = await prisma.platformState.upsert({
    where: { id: 'platform' },
    create: {
      id: 'platform',
      bootstrapVersion: 1,
      productFlags: {},
    },
    update: {},
  });
  console.log('Platform state OK:', {
    id: row.id,
    installedAt: row.installedAt.toISOString(),
    bootstrapVersion: row.bootstrapVersion,
  });
}

main()
  .catch((e) => {
    console.error('Bootstrap failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
