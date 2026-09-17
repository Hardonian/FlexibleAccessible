import type { PrismaClient } from '@aros/db';
import { parseEnvDiagnostics, getEmailOutboundSummary, type EnvDiagnostics } from '@aros/config';
import { CORE_SERVICES } from './registry';
import { checkPostgres, checkRedisPing, getQueueDepths } from './checks';
import { deriveReadinessFromServices, isWorkerHeartbeatStale, queueFailurePressure } from './state';
import type { CoreServiceRuntimeView, DependencyCheckResult, PlatformHealthReport } from './types';

const PLATFORM_ID = 'platform';

function toDependencyCheck(result: { ok: boolean; metadata?: { timestamp?: string }; checkedAt?: string; error?: { message: string } }): DependencyCheckResult {
  return {
    ok: result.ok,
    checkedAt: result.metadata?.timestamp ?? result.checkedAt ?? new Date().toISOString(),
    message: result.error?.message,
  };
}

function stripeConfigIssues(d: EnvDiagnostics): string[] {
  const issues: string[] = [];
  const hasSecret = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const hasWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  if (hasSecret && !hasWebhook) {
    issues.push('STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is set (webhook idempotency and subscription sync).');
  }
  if (!hasSecret && hasWebhook) {
    issues.push('STRIPE_SECRET_KEY is missing but STRIPE_WEBHOOK_SECRET is set; billing API calls will fail.');
  }
  return issues;
}

function githubConfigIssues(): { enabled: boolean; issues: string[]; summary: Record<string, string | boolean> } {
  const appId = Boolean(process.env.GITHUB_APP_ID?.trim());
  const pk = Boolean(process.env.GITHUB_APP_PRIVATE_KEY?.trim());
  const clientId = Boolean(process.env.GITHUB_CLIENT_ID?.trim());
  const clientSecret = Boolean(process.env.GITHUB_CLIENT_SECRET?.trim());
  const any = appId || pk || clientId || clientSecret;
  const appPair = appId && pk;
  const oauthPair = clientId && clientSecret;
  if (!any) {
    return { enabled: false, issues: [], summary: { configured: false } };
  }
  if (!appPair && !oauthPair) {
    return {
      enabled: true,
      issues: [
        'Set either GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY (GitHub App) or GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET (OAuth).',
      ],
      summary: { configured: 'partial' },
    };
  }
  return { enabled: true, issues: [], summary: { configured: true, mode: appPair ? 'github_app' : 'oauth' } };
}

function s3ConfigIssues(): { enabled: boolean; issues: string[]; summary: Record<string, string | boolean> } {
  const b = Boolean(process.env.S3_BUCKET?.trim());
  const r = Boolean(process.env.S3_REGION?.trim());
  const k = Boolean(process.env.S3_ACCESS_KEY?.trim());
  const s = Boolean(process.env.S3_SECRET_KEY?.trim());
  const any = b || r || k || s;
  if (!any) {
    return { enabled: false, issues: [], summary: { configured: false } };
  }
  const issues: string[] = [];
  if (!b) issues.push('S3_BUCKET is required when object storage is enabled.');
  if (!r) issues.push('S3_REGION is required when object storage is enabled.');
  if (!k || !s) issues.push('S3_ACCESS_KEY and S3_SECRET_KEY are both required when object storage is enabled.');
  return {
    enabled: true,
    issues,
    summary: {
      configured: issues.length === 0,
      bucketSet: b,
      regionSet: r,
    },
  };
}

function aiConfigSummary(): { enabled: boolean; summary: Record<string, boolean> } {
  const openai = Boolean(process.env.OPENAI_API_KEY?.trim());
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return {
    enabled: openai || anthropic,
    summary: { openai, anthropic },
  };
}

export async function collectPlatformHealth(prisma: PrismaClient): Promise<PlatformHealthReport> {
  const checkedAt = new Date().toISOString();
  const envDiag = parseEnvDiagnostics(process.env);

  /** Next.js sets this during `next build` static analysis; avoid live DB/Redis probes and log noise. */
  const skipLiveInfraProbes =
    process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

  if (skipLiveInfraProbes) {
    const sessionOk = envDiag.valid;
    const noopInfra = { ok: true as const, checkedAt, skipped: true as const };
    const emailSkip = getEmailOutboundSummary(process.env);
    return {
      checkedAt,
      liveInfraProbes: 'skipped_build',
      bootstrap: {
        installed: false,
        installedAt: null,
        bootstrapVersion: 0,
        readiness: 'ready',
        blockers: [] as string[],
        warnings: [] as string[],
      },
      dependencies: {
        database: noopInfra,
        redis: noopInfra,
        sessionStore: {
          ok: sessionOk,
          checkedAt,
          message: sessionOk ? undefined : 'Sessions require valid DATABASE_URL and env validation.',
        },
        outboundEmail: {
          ok: emailSkip.configured,
          checkedAt,
          message: emailSkip.configured ? undefined : 'SMTP not configured (build-time snapshot only).',
        },
      },
      services: [],
      operatorPlatformFlags: null,
      jobQueueDepths: null,
    };
  }

  const dbCheck = await checkPostgres(() => prisma.$queryRaw`SELECT 1`);
  const redisUrl = process.env.REDIS_URL?.trim() || 'redis://localhost:6379';
  const redisCheck = await checkRedisPing(redisUrl);

  let platformRow: {
    installedAt: Date;
    bootstrapVersion: number;
    workerLastHeartbeatAt: Date | null;
    productFlags: unknown;
  } | null = null;

  if (dbCheck.ok) {
    try {
      platformRow = await prisma.platformState.findUnique({
        where: { id: PLATFORM_ID },
        select: {
          installedAt: true,
          bootstrapVersion: true,
          workerLastHeartbeatAt: true,
          productFlags: true,
        },
      });
    } catch {
      platformRow = null;
    }
  }

  const installed = platformRow !== null;

  const queueResult = redisCheck.ok ? await getQueueDepths() : null;

  const workerStale = isWorkerHeartbeatStale(platformRow?.workerLastHeartbeatAt ?? null);
  const workerRunning = installed && redisCheck.ok && !workerStale && platformRow?.workerLastHeartbeatAt != null;

  const qPressure =
    queueResult?.ok === true
      ? queueFailurePressure(queueResult.data ?? (queueResult as any).snapshot)
      : { degraded: false, totalFailed: 0 };

  const sessionOk = dbCheck.ok && envDiag.valid;

  const emailSummary = getEmailOutboundSummary(process.env);
  const outboundEmailOk = emailSummary.configured;
  const outboundEmailMessage = outboundEmailOk
    ? undefined
    : 'Set SMTP_HOST, SMTP_PORT, EMAIL_FROM, and SMTP credentials (both SMTP_USER and SMTP_PASS, or neither) to enable password reset and signup email verification.';

  const services: CoreServiceRuntimeView[] = [];

  for (const def of CORE_SERVICES) {
    let view: CoreServiceRuntimeView;

    switch (def.id) {
      case 'app-api': {
        const ok = envDiag.valid;
        view = {
          ...def,
          enabled: true,
          configState: envDiag.valid ? 'valid' : 'invalid',
          configIssues: envDiag.valid ? [] : ['Fix environment validation errors (see config summary).'],
          configSummary: { envValid: envDiag.valid },
          healthState: ok ? 'ready' : 'misconfigured',
          lastCheckAt: checkedAt,
          lastActivityAt: null,
          failureReason: ok ? null : 'Invalid deployment environment',
          nextStep: ok ? 'No action required.' : 'Correct invalid environment variables and restart the app.',
          dependencies: { env: { ok: envDiag.valid, checkedAt, message: envDiag.valid ? undefined : 'See fieldErrors' } },
        };
        break;
      }
      case 'database': {
        view = {
          ...def,
          enabled: true,
          configState: 'valid',
          configIssues: [],
          configSummary: { reachable: dbCheck.ok },
          healthState: dbCheck.ok ? 'running' : 'unavailable',
          lastCheckAt: checkedAt,
          lastActivityAt: dbCheck.ok ? checkedAt : null,
          failureReason: dbCheck.ok ? null : dbCheck.error?.message ?? 'Unreachable',
          nextStep: dbCheck.ok
            ? 'No action required.'
            : 'Verify DATABASE_URL and database availability; run migrations after connectivity is restored.',
          dependencies: { postgres: toDependencyCheck(dbCheck) },
        };
        break;
      }
      case 'redis-queue': {
        const abusePosture = redisCheck.ok
          ? 'distributed_redis'
          : 'degraded_per_process_fallback_for_some_paths';
        view = {
          ...def,
          enabled: true,
          configState: 'valid',
          configIssues: [],
          configSummary: {
            reachable: redisCheck.ok,
            urlHost: redisUrl.split('@').pop()?.slice(0, 48) ?? 'default',
            abuseRateLimiting: abusePosture,
          },
          healthState: redisCheck.ok ? 'running' : 'unavailable',
          lastCheckAt: checkedAt,
          lastActivityAt: redisCheck.ok ? checkedAt : null,
          failureReason: redisCheck.ok
            ? null
            : (redisCheck.error?.message ?? 'Redis unreachable'),
          nextStep: redisCheck.ok
            ? 'No action required.'
            : 'Start Redis and set REDIS_URL; docker compose up includes Redis. Until then, some auth rate limits use per-process fallback (not synchronized across instances).',
          dependencies: { redis: toDependencyCheck(redisCheck) },
        };
        break;
      }
      case 'worker-runtime': {
        let health: CoreServiceRuntimeView['healthState'] = 'failed';
        let reason: string | null = 'No recent worker heartbeat recorded.';
        let next = 'Start the worker process: npm run dev:worker (or your process supervisor).';

        if (!redisCheck.ok) {
          health = 'unavailable';
          reason = 'Redis unreachable; workers cannot run.';
          next = 'Restore Redis first.';
        } else if (!installed) {
          health = 'unavailable';
          reason = 'Platform not bootstrapped in database.';
          next = 'Run npm run db:migrate && npm run db:seed.';
        } else if (workerRunning) {
          health = 'running';
          reason = null;
          next = 'No action required.';
        } else if (platformRow?.workerLastHeartbeatAt) {
          health = 'failed';
          reason = `Last heartbeat at ${platformRow.workerLastHeartbeatAt.toISOString()} is stale (>${120}s).`;
        }

        view = {
          ...def,
          enabled: true,
          configState: 'valid',
          configIssues: [],
          configSummary: {
            heartbeatFresh: workerRunning,
            lastHeartbeatAt: platformRow?.workerLastHeartbeatAt?.toISOString() ?? 'never',
          },
          healthState: health,
          lastCheckAt: checkedAt,
          lastActivityAt: platformRow?.workerLastHeartbeatAt?.toISOString() ?? null,
          failureReason: reason,
          nextStep: next,
          dependencies: { redis: toDependencyCheck(redisCheck), database: toDependencyCheck(dbCheck) },
        };
        break;
      }
      case 'job-pipelines': {
        let health: CoreServiceRuntimeView['healthState'] = 'ready';
        let reason: string | null = null;
        let next = 'No action required.';

        if (!dbCheck.ok || !redisCheck.ok) {
          health = 'unavailable';
          reason = !dbCheck.ok ? 'Database unavailable.' : 'Redis unavailable.';
          next = 'Restore database and Redis.';
        } else if (!workerRunning) {
          health = 'failed';
          reason = 'Workers are not processing jobs (missing or stale heartbeat).';
          next = 'Start workers and verify they can reach Redis.';
        } else if (queueResult?.ok === false) {
          health = 'degraded';
          reason = queueResult.error?.message ?? 'Could not read queue metrics.';
          next = 'Check Redis memory, BullMQ keys, and worker logs.';
        } else if (qPressure.degraded) {
          health = 'degraded';
          reason = `Elevated failed job count across queues (${qPressure.totalFailed}).`;
          next = 'Inspect failed jobs in Redis/BullMQ and worker error logs.';
        } else {
          health = 'running';
        }

        view = {
          ...def,
          enabled: true,
          configState: 'valid',
          configIssues: [],
          configSummary:
            queueResult?.ok === true
              ? {
                  queuesReadable: true,
                  failedJobsTotal: qPressure.totalFailed,
                  waitingTotal:
                    ((queueResult.data ?? (queueResult as any).snapshot)?.crawl?.waiting ?? 0) +
                    ((queueResult.data ?? (queueResult as any).snapshot)?.scan?.waiting ?? 0) +
                    ((queueResult.data ?? (queueResult as any).snapshot)?.cluster?.waiting ?? 0) +
                    ((queueResult.data ?? (queueResult as any).snapshot)?.remediation?.waiting ?? 0) +
                    ((queueResult.data ?? (queueResult as any).snapshot)?.publicScan?.waiting ?? 0) +
                    ((queueResult.data ?? (queueResult as any).snapshot)?.visualReview?.waiting ?? 0),
                }
              : { queuesReadable: false },
          healthState: health,
          lastCheckAt: checkedAt,
          lastActivityAt: platformRow?.workerLastHeartbeatAt?.toISOString() ?? null,
          failureReason: reason,
          nextStep: next,
          dependencies: { postgres: toDependencyCheck(dbCheck), redis: toDependencyCheck(redisCheck) },
        };
        break;
      }
      case 'session-auth': {
        view = {
          ...def,
          enabled: true,
          configState: envDiag.valid ? 'valid' : 'invalid',
          configIssues: envDiag.valid ? [] : ['Environment validation failed (see config summary).'],
          configSummary: {
            cookieSession: true,
            emailVerificationRequiresSmtp: true,
            outboundEmailConfigured: outboundEmailOk,
          },
          healthState: sessionOk ? 'running' : dbCheck.ok ? 'misconfigured' : 'unavailable',
          lastCheckAt: checkedAt,
          lastActivityAt: null,
          failureReason: sessionOk ? null : !dbCheck.ok ? dbCheck.error?.message ?? null : 'Session environment invalid',
          nextStep: sessionOk
            ? outboundEmailOk
              ? 'No action required.'
              : 'Optional: configure SMTP_* and EMAIL_FROM for password reset and signup verification email.'
            : 'Fix DATABASE_URL and required env vars; see environment validation errors.',
          dependencies: {
            postgres: toDependencyCheck(dbCheck),
            env: { ok: envDiag.valid, checkedAt },
            outboundEmail: {
              ok: outboundEmailOk,
              checkedAt,
              message: outboundEmailMessage,
            },
          },
        };
        break;
      }
      case 'stripe-billing': {
        const issues = stripeConfigIssues(envDiag);
        const hasAnyStripe = Boolean(process.env.STRIPE_SECRET_KEY?.trim() || process.env.STRIPE_WEBHOOK_SECRET?.trim());
        const misconfigured = issues.length > 0;
        const billingReady =
          hasAnyStripe && !misconfigured && dbCheck.ok;
        view = {
          ...def,
          enabled: hasAnyStripe,
          configState: misconfigured ? 'invalid' : hasAnyStripe ? 'valid' : 'partial',
          configIssues: issues,
          configSummary: {
            billingConfigured: hasAnyStripe && !misconfigured,
          },
          healthState: !hasAnyStripe
            ? 'disabled'
            : misconfigured
              ? 'misconfigured'
              : billingReady
                ? 'ready'
                : 'degraded',
          lastCheckAt: checkedAt,
          lastActivityAt: null,
          failureReason: misconfigured ? issues[0] : !dbCheck.ok ? 'Database unavailable; billing state cannot be persisted safely.' : null,
          nextStep: !hasAnyStripe
            ? 'Optional: set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to enable billing.'
            : misconfigured
              ? issues[0]
              : !dbCheck.ok
                ? 'Restore database connectivity before relying on billing webhooks.'
                : 'No action required for billing connectivity.',
          dependencies: { postgres: toDependencyCheck(dbCheck) },
        };
        break;
      }
      case 'github-connector': {
        const gh = githubConfigIssues();
        const misconfigured = gh.issues.length > 0;
        view = {
          ...def,
          enabled: gh.enabled,
          configState: !gh.enabled ? 'partial' : misconfigured ? 'invalid' : 'valid',
          configIssues: gh.issues,
          configSummary: gh.summary as Record<string, string | boolean>,
          healthState: !gh.enabled ? 'disabled' : misconfigured ? 'misconfigured' : dbCheck.ok ? 'ready' : 'unavailable',
          lastCheckAt: checkedAt,
          lastActivityAt: null,
          failureReason: misconfigured ? gh.issues[0] : null,
          nextStep: !gh.enabled
            ? 'Optional: configure GitHub App or OAuth credentials for repository features.'
            : misconfigured
              ? gh.issues[0]
              : 'No action required.',
          dependencies: { postgres: toDependencyCheck(dbCheck) },
        };
        break;
      }
      case 'jira-connector': {
        view = {
          ...def,
          enabled: true,
          configState: 'partial',
          configIssues: [],
          configSummary: {
            note: 'Connections are stored per organization in integration_connections (type JIRA).',
          },
          healthState: dbCheck.ok ? 'ready' : 'unavailable',
          lastCheckAt: checkedAt,
          lastActivityAt: null,
          failureReason: dbCheck.ok ? null : dbCheck.error?.message ?? null,
          nextStep: dbCheck.ok
            ? 'Add a Jira integration from organization settings when needed.'
            : 'Restore database connectivity.',
          dependencies: { postgres: toDependencyCheck(dbCheck) },
        };
        break;
      }
      case 'ai-remediation': {
        const ai = aiConfigSummary();
        view = {
          ...def,
          enabled: ai.enabled,
          configState: ai.enabled ? 'valid' : 'partial',
          configIssues: [],
          configSummary: ai.summary as Record<string, string | boolean>,
          healthState: ai.enabled ? (workerRunning ? 'running' : 'degraded') : 'disabled',
          lastCheckAt: checkedAt,
          lastActivityAt: null,
          failureReason:
            ai.enabled && !workerRunning
              ? 'Remediation queue needs workers; heartbeat is missing or stale.'
              : null,
          nextStep: ai.enabled
            ? workerRunning
              ? 'No action required.'
              : 'Start workers to process remediation jobs.'
            : 'Optional: set OPENAI_API_KEY or ANTHROPIC_API_KEY for enhanced suggestions (rule-based path works without).',
          dependencies: { redis: toDependencyCheck(redisCheck) },
        };
        break;
      }
      case 'object-storage': {
        const s3 = s3ConfigIssues();
        const misconfigured = s3.issues.length > 0;
        view = {
          ...def,
          enabled: s3.enabled,
          configState: !s3.enabled ? 'partial' : misconfigured ? 'invalid' : 'valid',
          configIssues: s3.issues,
          configSummary: {
            ...(s3.summary as Record<string, string | boolean>),
            scanScreenshotMode: s3.enabled && !misconfigured ? 's3_object_keys' : 'inline_data_uri_in_database',
          },
          healthState: !s3.enabled ? 'disabled' : misconfigured ? 'misconfigured' : 'ready',
          lastCheckAt: checkedAt,
          lastActivityAt: null,
          failureReason: misconfigured ? s3.issues[0] : null,
          nextStep: !s3.enabled
            ? 'Without S3, scan screenshots are stored as inline JPEG data URIs on PageSnapshot rows (larger DB footprint). Configure S3_* for object-key storage and easier retention.'
            : misconfigured
              ? s3.issues[0]
              : 'No action required.',
          dependencies: {},
        };
        break;
      }
      default: {
        view = {
          ...def,
          enabled: false,
          configState: 'partial',
          configIssues: [],
          configSummary: {},
          healthState: 'unavailable',
          lastCheckAt: checkedAt,
          lastActivityAt: null,
          failureReason: 'Unknown service id in registry',
          nextStep: 'Update @aros/core-services registry.',
          dependencies: {},
        };
      }
    }

    services.push(view);
  }

  const readinessPartial = deriveReadinessFromServices(services);

  const bootstrap = installed
    ? {
        installed: true as const,
        installedAt: platformRow!.installedAt.toISOString(),
        bootstrapVersion: platformRow!.bootstrapVersion,
        ...readinessPartial,
      }
    : {
        installed: false as const,
        installedAt: null,
        bootstrapVersion: 0,
        readiness: 'not_installed' as const,
        blockers: [
          'Platform state row missing. Apply migrations and seed: npm run db:migrate && npm run db:seed.',
        ],
        warnings: [] as string[],
      };

  const rawFlags = platformRow?.productFlags;
  const operatorPlatformFlags =
    rawFlags && typeof rawFlags === 'object' && !Array.isArray(rawFlags)
      ? (rawFlags as Record<string, unknown>)
      : null;

  const jobQueueDepths =
    queueResult?.ok === true
      ? {
          checkedAt: queueResult.metadata?.timestamp ?? (queueResult as any).checkedAt ?? new Date().toISOString(),
          snapshot: (queueResult.data ?? (queueResult as any).snapshot)!,
        }
      : null;

  return {
    checkedAt,
    liveInfraProbes: 'live',
    bootstrap,
    dependencies: {
      database: toDependencyCheck(dbCheck),
      redis: toDependencyCheck(redisCheck),
      sessionStore: {
        ok: sessionOk,
        checkedAt,
        message: sessionOk ? undefined : 'Sessions require valid DATABASE_URL and env validation.',
      },
      outboundEmail: {
        ok: outboundEmailOk,
        checkedAt,
        message: outboundEmailMessage,
      },
    },
    services,
    operatorPlatformFlags,
    jobQueueDepths,
  };
}
