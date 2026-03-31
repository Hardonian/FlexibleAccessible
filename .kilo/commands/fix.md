---
description: "Generate and apply remediation suggestions"
---

# Fix Accessibility Issues

Generate AI-powered remediation suggestions for open findings.

## Usage

```
npx aros fix <site-id> [--limit 20] [--approve-high-confidence]
```

## Steps

1. Query open findings without existing suggestions
2. Generate fix using rule-based engine or LLM (if configured)
3. Validate fix for safety (no XSS, balanced HTML, valid ARIA)
4. Auto-approve if confidence >= 80% and --approve-high-confidence set
5. Otherwise create review task for human approval
