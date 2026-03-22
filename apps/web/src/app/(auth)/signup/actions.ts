'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/session';
import { hashPassword, slugify } from '@aros/shared';

interface SignupState {
  error: string | null;
}

export async function signupAction(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const orgName = (formData.get('orgName') as string)?.trim();

  if (!name || !email || !password || !orgName) {
    return { error: 'All fields are required' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'An account with this email already exists' };
  }

  const passwordHash = await hashPassword(password);
  const orgSlug = slugify(orgName);

  // Check for slug collision
  const existingOrg = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (existingOrg) {
    return { error: 'An organization with a similar name already exists. Please choose a different name.' };
  }

  // Create user, org, membership, workspace, and free subscription in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name, passwordHash },
    });

    const org = await tx.organization.create({
      data: { name: orgName, slug: orgSlug },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'OWNER',
      },
    });

    await tx.workspace.create({
      data: {
        organizationId: org.id,
        name: 'Default',
        slug: 'default',
      },
    });

    await tx.subscription.create({
      data: {
        organizationId: org.id,
        plan: 'FREE',
        status: 'ACTIVE',
        maxDomains: 1,
        maxPagesPerCrawl: 50,
        maxScansPerMonth: 3,
        maxSeats: 1,
      },
    });

    return user;
  });

  await createSession(result.id);
  redirect('/dashboard');
}
