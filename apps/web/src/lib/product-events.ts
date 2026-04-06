import { prisma } from '@/lib/db';
import type { Prisma } from '@aros/db';

/** Decision-oriented audit trail (not a third-party analytics pipeline). */
export const PRODUCT_EVENT_ACTIONS = {
  signup_completed: 'product:signup_completed',
  checkout_started: 'product:checkout_started',
  invite_sent: 'product:invite_sent',
  api_key_created: 'product:api_key_created',
  first_private_scan_queued: 'product:first_private_scan_queued',
} as const;

export type ProductEventAction =
  (typeof PRODUCT_EVENT_ACTIONS)[keyof typeof PRODUCT_EVENT_ACTIONS];

export async function logProductEvent(input: {
  organizationId: string;
  userId: string | null;
  action: ProductEventAction;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (e) {
    console.error('[product-events] audit log failed', input.action, e);
  }
}
