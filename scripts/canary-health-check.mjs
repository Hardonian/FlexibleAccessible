#!/usr/bin/env node
/**
 * AROS Synthetic Canary Health Monitor
 * Runs every 5-15 minutes to verify production uptime, DB/queue latency, and core endpoints.
 * Alerts the solo founder via Slack/Discord if any degradation occurs.
 */

const BASE_URL = process.env.CANARY_TARGET_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;

async function sendAlert(message) {
  console.error(`[CANARY ALERT] ${message}`);
  if (!ALERT_WEBHOOK_URL) return;

  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 *AROS Production Canary Failure*\n${message}\n• *Target:* ${BASE_URL}\n• *Time:* ${new Date().toISOString()}`,
      }),
    });
  } catch (err) {
    console.error('[CANARY ALERT FAILED TO DISPATCH]', err);
  }
}

async function runCanary() {
  console.log(`[CANARY] Checking target: ${BASE_URL}`);
  const errors = [];

  // Check 1: Health API
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(8000) });
    const latency = Date.now() - t0;
    if (!res.ok) {
      errors.push(`Health endpoint returned status ${res.status}`);
    } else {
      const data = await res.json();
      console.log(`[CANARY] Health OK (${latency}ms):`, data.status ?? 'ok');
      if (data.status === 'degraded') {
        errors.push(`Health status reported degraded: ${JSON.stringify(data.issues || data.degradedServices || {})}`);
      }
    }
  } catch (err) {
    errors.push(`Health check failed to respond: ${err.message}`);
  }

  // Check 2: Embeddable Badge API
  try {
    const res = await fetch(`${BASE_URL}/api/badge?domain=aros.dev`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok && res.status !== 404) {
      errors.push(`Badge endpoint returned status ${res.status}`);
    } else {
      console.log('[CANARY] Badge SVG endpoint OK');
    }
  } catch (err) {
    errors.push(`Badge endpoint failed: ${err.message}`);
  }

  // Check 3: Public Marketing / Landing page
  try {
    const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      errors.push(`Landing page returned status ${res.status}`);
    } else {
      console.log('[CANARY] Landing page OK');
    }
  } catch (err) {
    errors.push(`Landing page failed: ${err.message}`);
  }

  if (errors.length > 0) {
    const summary = errors.map((e) => `• ${e}`).join('\n');
    await sendAlert(summary);
    process.exit(1);
  }

  console.log('[CANARY] All production canary checks passed successfully.');
}

runCanary();
