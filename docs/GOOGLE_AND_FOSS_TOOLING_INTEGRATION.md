# AROS Integration with Google & FOSS Developer Tools

AROS (Accessibility Remediation OS) is designed for immediate, zero-friction adoption by engineering teams already using industry-standard Google developer tools and Free & Open Source Software (FOSS) accessibility engines.

---

## 1. Google Lighthouse & Lighthouse CI (LHCI)

Teams running automated Lighthouse audits in CI/CD pipelines (GitHub Actions, GitLab CI, Vercel Previews) can integrate AROS directly.

### 1.1 Out-of-the-Box Configuration (`.lighthouserc.json`)
The repository includes a ready-to-use `.lighthouserc.json` asserting strict WCAG 2.2 accessibility thresholds:

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "color-contrast": "error",
        "image-alt": "error",
        "button-name": "error"
      }
    }
  }
}
```

### 1.2 Programmatic Lighthouse Ingestion (`@aros/integrations`)
Convert any standard Lighthouse JSON Report (LHR) into AROS canonical findings and 80/20 component clusters:

```typescript
import { parseLighthouseReport, exportToLighthouseAssertions } from "@aros/integrations";

// 1. Ingest LHR from Google Lighthouse CLI or Chrome DevTools
const findings = parseLighthouseReport(lighthouseResult);

// 2. Validate against LHCI threshold standards
const assertionResult = exportToLighthouseAssertions(findings);
console.log(`Lighthouse a11y score: ${assertionResult.score}`);
```

---

## 2. Google Chrome DevTools & CDP (Chrome DevTools Protocol)

AROS findings map 1-to-1 to the Google Chrome DevTools `Audits.InspectorIssue` schema:

### 2.1 Exporting to Chrome DevTools Inspector Issues
Engineering teams can export issues directly into Chrome DevTools:

```typescript
import { exportToChromeDevToolsIssues } from "@aros/integrations";

const devToolsIssues = exportToChromeDevToolsIssues(findings);
// Directly inspectable in Chrome DevTools "Issues" tab
```

### 2.2 Chrome Accessibility Tree Alignment
AROS DOM selectors and bounding boxes correspond directly to the Chromium Accessibility Object Model (AOM) and Chrome DevTools Accessibility Tree panel.

---

## 3. FOSS Accessibility Tooling (Pa11y & Axe-Core)

If your organization has legacy scripts using Pa11y or the Axe CLI, AROS ingests them without requiring code changes to your existing test suites.

### 3.1 Ingesting Pa11y CLI Output
```typescript
import { parsePa11yReport } from "@aros/integrations";

const findings = parsePa11yReport(pa11yJsonOutput);
// Deduplicated, prioritized, and ready for AST remediation recipes
```

---

## 4. Summary: Easy Adoption Matrix

| Tool / Standard | Role in AROS Workflow | Adoption Difficulty |
| :--- | :--- | :---: |
| **Google Lighthouse** | CI/CD threshold gate & LHR ingestion | **Zero-config** (`.lighthouserc.json`) |
| **Google Chrome DevTools** | Visual issue inspection & DOM tree mapping | **Plug-and-play** (CDP Issue schema) |
| **Deque Axe-Core** | Core deterministic scanning engine | **Native built-in** |
| **Pa11y / HTML_CodeSniffer** | Multi-engine defect ingestion | **1-line import adapter** |
