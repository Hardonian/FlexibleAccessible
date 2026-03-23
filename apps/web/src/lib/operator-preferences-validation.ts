import { CORE_SERVICES } from '@aros/core-services';

const optionalServiceIds = new Set(
  CORE_SERVICES.filter((s) => s.criticality === 'optional').map((s) => s.id)
);

export function isValidOptionalDiagnosticId(id: string): boolean {
  if (!id.startsWith('svc:')) return false;
  const svcId = id.slice(4);
  return optionalServiceIds.has(svcId);
}

export function validateSuppressedOptionalDiagnosticIds(ids: string[]): { ok: true } | { ok: false; invalid: string[] } {
  const invalid = ids.filter((id) => !isValidOptionalDiagnosticId(id));
  if (invalid.length > 0) return { ok: false, invalid };
  return { ok: true };
}
