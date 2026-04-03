import { prisma } from "@/lib/db";

export async function findRecentPublicScanForRateLimit(input: {
  domain: string;
  ipHash: string;
  rateLimitSeconds: number;
}) {
  return prisma.publicScanResult.findFirst({
    where: {
      domain: input.domain,
      ipHash: input.ipHash,
      createdAt: { gte: new Date(Date.now() - input.rateLimitSeconds * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPublicScanResult(input: {
  domain: string;
  url: string;
  status: "PENDING";
  maxPages: number;
  ipHash: string;
  expiresAt: Date;
}) {
  return prisma.publicScanResult.create({
    data: input,
  });
}
