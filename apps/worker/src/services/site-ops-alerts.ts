import type { PrismaClient } from '@aros/db';

const STALE_HOURS = 72;
const ALERT_ACTION = 'site.ops.alert_transition';

type AlertState = 'scan_attention_required' | 'evidence_stale' | 'healthy';

interface SiteAlertSnapshot {
  state: AlertState;
  reason: string;
}

function hoursSince(ts: Date): number {
  return (Date.now() - ts.getTime()) / (1000 * 60 * 60);
}

export function deriveSiteOpsAlertState(input: {
  latestScanStatus: string | null;
  latestCompletedScanAt: Date | null;
  hasAnyCompletedScan: boolean;
}): SiteAlertSnapshot {
  if (input.latestScanStatus === 'FAILED') {
    return {
      state: 'scan_attention_required',
      reason: 'Latest verification scan failed.',
    };
  }

  if (!input.hasAnyCompletedScan) {
    return {
      state: 'evidence_stale',
      reason: 'No completed verification scan exists yet.',
    };
  }

  if (!input.latestCompletedScanAt || hoursSince(input.latestCompletedScanAt) > STALE_HOURS) {
    return {
      state: 'evidence_stale',
      reason: 'Latest completed verification scan is older than 72 hours.',
    };
  }

  return {
    state: 'healthy',
    reason: 'Verification scan health is within freshness window.',
  };
}

function parseLastAlertState(metadata: unknown): AlertState | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const state = (metadata as Record<string, unknown>).state;
  if (state === 'scan_attention_required' || state === 'evidence_stale' || state === 'healthy') {
    return state;
  }
  return null;
}

function parseNotifyUrl(candidate: string | null): URL | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

async function postAlertWebhook(url: URL, payload: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Webhook responded ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function runSiteOpsAlertTick(prisma: PrismaClient) {
  const sites = await prisma.site.findMany({
    where: {
      deployWebhooks: {
        some: {
          isActive: true,
          notifyChannel: { not: null },
        },
      },
    },
    select: {
      id: true,
      name: true,
      domain: true,
      workspace: {
        select: {
          organizationId: true,
          organization: { select: { name: true } },
        },
      },
      deployWebhooks: {
        where: { isActive: true, notifyChannel: { not: null } },
        select: { notifyChannel: true },
      },
      scanRuns: {
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { status: true, completedAt: true },
      },
    },
  });

  let notificationsSent = 0;
  let transitionsDetected = 0;

  for (const site of sites) {
    const latestScan = site.scanRuns[0] ?? null;
    const latestCompleted = site.scanRuns.find((run) => run.status === 'COMPLETED') ?? null;

    const snapshot = deriveSiteOpsAlertState({
      latestScanStatus: latestScan?.status ?? null,
      latestCompletedScanAt: latestCompleted?.completedAt ?? null,
      hasAnyCompletedScan: Boolean(latestCompleted),
    });

    const previous = await prisma.auditLog.findFirst({
      where: {
        organizationId: site.workspace.organizationId,
        action: ALERT_ACTION,
        entityType: 'Site',
        entityId: site.id,
      },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });

    const previousState = parseLastAlertState(previous?.metadata);
    if (previousState === snapshot.state) {
      continue;
    }

    transitionsDetected += 1;

    const validNotifyUrls = Array.from(
      new Set(
        site.deployWebhooks
          .map((hook) => parseNotifyUrl(hook.notifyChannel))
          .filter((url): url is URL => Boolean(url)),
      ),
    );

    if (snapshot.state !== 'healthy' && validNotifyUrls.length > 0) {
      const payload = {
        event: 'site_ops_state_transition',
        site: { id: site.id, name: site.name, domain: site.domain },
        organization: {
          id: site.workspace.organizationId,
          name: site.workspace.organization.name,
        },
        currentState: snapshot.state,
        previousState,
        reason: snapshot.reason,
        occurredAt: new Date().toISOString(),
      };

      for (const url of validNotifyUrls) {
        await postAlertWebhook(url, payload).catch((error) => {
          console.warn('[SiteOpsAlert] webhook delivery failed', {
            siteId: site.id,
            url: url.toString(),
            error: error instanceof Error ? error.message : String(error),
          });
        });
        notificationsSent += 1;
      }
    }

    await prisma.auditLog.create({
      data: {
        organizationId: site.workspace.organizationId,
        action: ALERT_ACTION,
        entityType: 'Site',
        entityId: site.id,
        metadata: {
          state: snapshot.state,
          previousState,
          reason: snapshot.reason,
          notifyUrlCount: validNotifyUrls.length,
        },
      },
    });
  }

  return { checked: sites.length, transitionsDetected, notificationsSent };
}

export const siteOpsAlertConstants = {
  STALE_HOURS,
  ALERT_ACTION,
};
