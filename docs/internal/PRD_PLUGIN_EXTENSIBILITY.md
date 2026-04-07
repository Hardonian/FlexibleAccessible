# PRD: Custom checks & plugin extensibility (B8)

**Status:** Scaffold / product definition — not implemented in engine.  
**Last updated:** 2026-04-07.

## Problem

Enterprises want **organization-specific rules**, **custom selectors**, or **internal design-system packs** without forking the scan engine.

## Goals

1. Run **versioned** custom checks in the worker with the same **tenant isolation** as built-in axe normalization.
2. **Cap** runtime and network per job (margin protection).
3. Emit findings that map into the existing `CanonicalFinding` model (rule id namespace, evidence source).

## Non-goals

- Arbitrary code upload from the browser without operator review.
- Replacing axe-core as the primary automated engine.

## Proposed design

### 1. Rule namespace

- Built-in: `axe:*`, engine-native ids.
- Custom: `org:{orgId}:rule:{slug}` or `plugin:{pluginId}:rule:{slug}`.

### 2. Distribution model (pick one per deployment)

- **A.** Git-backed packages built into worker image (operator-controlled).
- **B.** Signed WASM bundles stored in object storage, hash-pinned per org (future).

### 3. Execution contract

```ts
// Conceptual — not shipped
export interface CustomCheckContext {
  organizationId: string;
  pageUrl: string;
  domSnapshotId: string;
}
export interface CustomCheckResult {
  ruleId: string;
  impact: 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR';
  description: string;
  selector?: string;
  elementHtml?: string;
}
```

### 4. Worker integration

- After axe scan, invoke `runCustomChecks(ctx)` if org has enabled plugins.
- Enforce **timeout** (e.g. 2s) and **memory** ceiling; kill on breach.

### 5. Admin & billing

- Feature flag per org; Professional+ suggested.
- Meter as `scan.custom_check_ms` or count per run for margin.

## Milestones

1. Schema: `OrganizationPlugin` + enablement + version pin.  
2. Worker hook + noop sample plugin in monorepo.  
3. UI: enable toggle + audit log event.  
4. Pricing: include N custom rules in Enterprise or add-on.

## Open questions

- Sandboxing: WASM vs isolated VM vs separate sidecar process.  
- Who signs bundles: operator only vs marketplace (later).
