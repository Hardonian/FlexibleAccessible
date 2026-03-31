---
description: "Run accessibility scan on a site"
---

# Scan Site

Run an accessibility scan using AROS CLI.

## Usage

```
npx aros scan <url> [--format json|csv] [--ci] [--threshold serious]
```

## Steps

1. Launch headless Chromium via Playwright
2. Inject axe-core and run WCAG 2.2 checks
3. Output violations in requested format
4. Exit code 1 if CI mode and violations found

## Options

- `--format json|csv` — Output format
- `--output <file>` — Write to file
- `--ci` — Exit 1 on violations
- `--threshold critical|serious|moderate|minor` — Minimum severity
