import type { Prisma } from '@aros/db';
import { ApiError } from '@aros/shared';
import { prisma } from '@/lib/db';
import {
  parseOperatorPlatformFlags,
  serializeOperatorPlatformFlags,
  type ParsedOperatorPlatformFlags,
} from '@aros/core-services';

export async function loadProductFlagsRecord(): Promise<Record<string, unknown>> {
  const row = await prisma.platformState.findUnique({
    where: { id: 'platform' },
    select: { productFlags: true },
  });
  const raw = row?.productFlags;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export async function saveProductFlagsRecord(next: Record<string, unknown>) {
  await prisma.platformState.update({
    where: { id: 'platform' },
    data: { productFlags: next as Prisma.InputJsonValue },
  });
}

export async function updateOperatorFlags(mutator: (current: ParsedOperatorPlatformFlags) => ParsedOperatorPlatformFlags) {
  const exists = await prisma.platformState.findUnique({ where: { id: 'platform' }, select: { id: true } });
  if (!exists) {
    throw ApiError.badRequest('Platform is not installed in the database; run migrations and bootstrap before using operator actions.');
  }
  const merged = await loadProductFlagsRecord();
  const parsed = parseOperatorPlatformFlags(merged);
  const updated = mutator(parsed);
  const serialized = serializeOperatorPlatformFlags(updated);
  await saveProductFlagsRecord({ ...merged, ...serialized });
  return updated;
}
