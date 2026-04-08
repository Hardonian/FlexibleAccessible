export interface SiteScanDelta {
  comparable: boolean;
  newCount: number;
  resolvedCount: number;
  persistingCount: number;
}

export function computeScanDelta(
  latestFingerprints: Iterable<string>,
  previousFingerprints: Iterable<string> | null,
): SiteScanDelta {
  const latest = new Set(latestFingerprints);
  if (!previousFingerprints) {
    return {
      comparable: false,
      newCount: latest.size,
      resolvedCount: 0,
      persistingCount: 0,
    };
  }

  const previous = new Set(previousFingerprints);

  let newCount = 0;
  let persistingCount = 0;
  for (const fingerprint of latest) {
    if (previous.has(fingerprint)) persistingCount += 1;
    else newCount += 1;
  }

  let resolvedCount = 0;
  for (const fingerprint of previous) {
    if (!latest.has(fingerprint)) resolvedCount += 1;
  }

  return {
    comparable: true,
    newCount,
    resolvedCount,
    persistingCount,
  };
}
