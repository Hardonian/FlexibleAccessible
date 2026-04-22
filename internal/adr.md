# AccessibleMadeFlexible ADRs

## ADR-001: Multi-Scanner Normalization

**Status**: Accepted

### Context
axe-core, Lighthouse, HTML_CodeSniffer, WAVE all find different issues. Need unified view.

### Decision
Normalize all findings into canonical issues with fingerprint. Cluster by component pattern.

### Consequences
- Pro: Single source of truth
- Pro: Accurate severity
- Con: Complex normalization logic

## ADR-002: Source-Level Routing

**Status**: Accepted

### Context
Fixes should go to source files, not dev tools.

### Decision
Map issues to source files using build artifacts and source maps.

### Consequences
- Pro: Direct fix routing
- Pro: PR-ready diffs
- Con: Requires source maps

## ADR-003: AI as Assistant Not Authority

**Status**: Accepted

### Context
AI suggests fixes but doesn't make compliance calls.

### Decision
AI generates suggestions with confidence scores. Human review for non-high-confidence.

### Consequences
- Pro: Helpful, not dangerous
- Pro: Audit trail
- Con: Some manual review
