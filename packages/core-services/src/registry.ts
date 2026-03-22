import type { CoreServiceDefinition } from './types';

/**
 * Canonical registry of platform-managed capabilities.
 * IDs are stable API contracts; add new services here and wire checks in orchestrator.
 */
export const CORE_SERVICES: CoreServiceDefinition[] = [
  {
    id: 'app-api',
    name: 'Web application',
    purpose: 'Serves the Next.js UI and API routes.',
    category: 'data',
    criticality: 'critical',
    scope: 'deployment',
    userVisibleWhenDown: true,
  },
  {
    id: 'database',
    name: 'PostgreSQL',
    purpose: 'Primary data store for orgs, sites, findings, and platform state.',
    category: 'data',
    criticality: 'critical',
    scope: 'deployment',
    userVisibleWhenDown: true,
  },
  {
    id: 'redis-queue',
    name: 'Redis (BullMQ)',
    purpose: 'Job queues for crawl, scan, cluster, and remediation workers.',
    category: 'queue',
    criticality: 'critical',
    scope: 'deployment',
    userVisibleWhenDown: true,
  },
  {
    id: 'worker-runtime',
    name: 'Background workers',
    purpose: 'Processes queued crawl, scan, cluster, and remediation jobs.',
    category: 'queue',
    criticality: 'critical',
    scope: 'deployment',
    userVisibleWhenDown: true,
  },
  {
    id: 'job-pipelines',
    name: 'Accessibility job pipelines',
    purpose: 'End-to-end crawl → scan → cluster → remediation execution path.',
    category: 'data',
    criticality: 'critical',
    scope: 'deployment',
    userVisibleWhenDown: true,
  },
  {
    id: 'session-auth',
    name: 'Sessions & sign-in',
    purpose: 'Cookie-backed sessions and organization access control.',
    category: 'auth',
    criticality: 'critical',
    scope: 'deployment',
    userVisibleWhenDown: true,
  },
  {
    id: 'stripe-billing',
    name: 'Stripe billing',
    purpose: 'Subscription lifecycle and webhook processing.',
    category: 'billing',
    criticality: 'optional',
    scope: 'deployment',
    userVisibleWhenDown: false,
  },
  {
    id: 'github-connector',
    name: 'GitHub connector',
    purpose: 'Repository mappings and GitHub App connectivity.',
    category: 'integration',
    criticality: 'optional',
    scope: 'deployment',
    userVisibleWhenDown: false,
  },
  {
    id: 'jira-connector',
    name: 'Jira connector',
    purpose: 'Export and ticketing integrations (org connections in database).',
    category: 'integration',
    criticality: 'optional',
    scope: 'deployment',
    userVisibleWhenDown: false,
  },
  {
    id: 'ai-remediation',
    name: 'AI-assisted remediation',
    purpose: 'Optional LLM-backed suggestion quality (rule-based fallback without keys).',
    category: 'ai',
    criticality: 'optional',
    scope: 'deployment',
    userVisibleWhenDown: false,
  },
  {
    id: 'object-storage',
    name: 'Object storage (S3)',
    purpose: 'Screenshots and evidence artifacts when configured.',
    category: 'storage',
    criticality: 'optional',
    scope: 'deployment',
    userVisibleWhenDown: false,
  },
];

export function getServiceDefinition(id: string): CoreServiceDefinition | undefined {
  return CORE_SERVICES.find((s) => s.id === id);
}
