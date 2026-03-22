'use server';

import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';

export async function approveSuggestionAction(formData: FormData) {
  const user = await requireSession();
  const suggestionId = formData.get('suggestionId') as string;

  await prisma.remediationSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: 'APPROVED',
      appliedBy: user.id,
      appliedAt: new Date(),
    },
  });

  redirect(`/remediation/${suggestionId}`);
}

export async function rejectSuggestionAction(formData: FormData) {
  await requireSession();
  const suggestionId = formData.get('suggestionId') as string;

  await prisma.remediationSuggestion.update({
    where: { id: suggestionId },
    data: { status: 'REJECTED' },
  });

  redirect(`/remediation/${suggestionId}`);
}

export async function exportSnippetAction(formData: FormData) {
  await requireSession();
  const suggestionId = formData.get('suggestionId') as string;

  await prisma.remediationSuggestion.update({
    where: { id: suggestionId },
    data: { status: 'EXPORTED' },
  });

  redirect(`/remediation/${suggestionId}`);
}
