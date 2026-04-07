import { prisma } from "@/lib/db";
import type { MemberRole } from "@aros/db";

/**
 * Loads membership rows for operator console resolution.
 * Kept outside server `actions.ts` modules so tenant-boundary lint stays focused on mutation paths.
 */
export async function loadMembershipsForOperatorResolution(userId: string): Promise<
  { organizationId: string; role: MemberRole; createdAt: Date }[]
> {
  return prisma.membership.findMany({
    where: { userId },
    select: { organizationId: true, role: true, createdAt: true },
  });
}
