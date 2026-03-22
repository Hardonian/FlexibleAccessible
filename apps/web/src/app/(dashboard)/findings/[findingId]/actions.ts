'use server';

import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import type { FindingStatus } from '@aros/db';

export async function updateFindingStatusAction(formData: FormData) {
  await requireSession();
  const findingId = formData.get('findingId') as string;
  const status = formData.get('status') as FindingStatus;

  if (!findingId || !status) return;

  await prisma.canonicalFinding.update({
    where: { id: findingId },
    data: { status },
  });

  redirect(`/findings/${findingId}`);
}
