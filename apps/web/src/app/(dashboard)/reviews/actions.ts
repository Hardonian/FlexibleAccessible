'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import type { ReviewStatus } from '@aros/db';

export async function updateReviewAction(formData: FormData) {
  await requireSession();
  const taskId = formData.get('taskId') as string;
  const status = formData.get('status') as ReviewStatus;

  await prisma.reviewTask.update({
    where: { id: taskId },
    data: {
      status,
      reviewedAt: status === 'APPROVED' || status === 'REJECTED' ? new Date() : undefined,
    },
  });

  revalidatePath('/reviews');
}
