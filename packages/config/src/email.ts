/**
 * Outbound transactional email readiness (no secret values).
 * When not configured, password reset / verification must fail closed for delivery
 * and surface operator-visible "email not configured" state.
 */
export function getEmailOutboundSummary(env: NodeJS.ProcessEnv): {
  mode: 'smtp' | 'none';
  configured: boolean;
  hostSet: boolean;
  fromSet: boolean;
} {
  const host = Boolean(env.SMTP_HOST?.trim());
  const port = Boolean(env.SMTP_PORT?.trim());
  const user = Boolean(env.SMTP_USER?.trim());
  const pass = Boolean(env.SMTP_PASS?.trim());
  const from = Boolean(env.EMAIL_FROM?.trim());

  const smtpCore = host && port;
  const authPair = user && pass;
  const configured = smtpCore && (authPair || (!user && !pass)) && from;

  return {
    mode: configured ? 'smtp' : 'none',
    configured: Boolean(configured),
    hostSet: host,
    fromSet: from,
  };
}
