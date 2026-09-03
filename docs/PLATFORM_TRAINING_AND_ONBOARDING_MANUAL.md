# AROS: Platform Training & Frictionless Onboarding Manual

The definitive user guide and operating manual for engineering teams, compliance officers, and solo founders.

---

## 1. Quickstart: 60 Seconds to First Value

```text
Step 1: Run Public Baseline (0:00 - 0:15)
        Enter domain on home page → Instant scan of top routes.
        ↓
Step 2: Inspect Pareto 80/20 Leverage Curve (0:15 - 0:30)
        See how 2–3 component fixes clear 80% of all violations.
        ↓
Step 3: Connect GitHub & Open Verified PR (0:30 - 0:45)
        Map repository → Let AI Copilot open validated pull requests.
        ↓
Step 4: Export Signed VPAT 2.5 Compliance Report (0:45 - 1:00)
        Download legal VPAT matrix in HTML, Markdown, CSV, or JSON.
```

---

## 2. Core Modules & Daily Workflows

### 2.1 The Scan Engine & Crawl Execution

- **How Scans Work**: AROS dispatches headless Chromium browsers running automated Playwright sessions. Unlike superficial regex scanners, AROS evaluates the actual rendered DOM tree, computed CSS styles, and accessibility tree.
- **Fingerprinting**: Every defect is assigned a cryptographic SHA-256 fingerprint based on DOM selector, rule ID, and HTML target. This ensures finding identity persists across sprint releases.
- **Starting a Scan**:
  - Go to `/sites` → Select your site → Click **"Run Scan"**.
  - Worker concurrency handles multiple pages simultaneously without overloading target servers.

---

### 2.2 Finding Backlog & AI Copilot Triage

- **Navigating Findings**: Go to `/findings` to filter by Severity (Critical, Serious, Moderate, Minor) or Conformance Level (WCAG 2.2 Level A vs AA).
- **Finding Detail View**: Click on any finding to see:
  - Exact DOM selector and offending code snippet.
  - Verification trail and human sign-off history.
  - **AI Copilot Drawer**: Click "AI Copilot" to trigger streaming explanations:
    - *Expert Mode*: Provides senior accessibility engineering rationale.
    - *Teach Mode*: Explains the defect using plain English analogies for junior developers.
  - **Threaded Comments**: Leave notes, tag teammates, or record auditor justifications.

---

### 2.3 Pareto Clustering & High-Leverage Fixes

- **The 80/20 Problem**: Fixing 500 individual page errors is demoralizing and inefficient.
- **The AROS Solution**: Navigate to `/clusters`. The clustering engine groups identical defects across shared layout components (e.g. your navigation header, modal dialogs, or footer links).
- **ROI Metric**: The **Pareto Impact Card** displays:
  - Percentage of total violations eliminated by fixing the top cluster.
  - Developer hours saved.
  - Estimated financial ROI.

---

### 2.4 Self-Serve VPAT 2.5 Compliance Reporting

- **Why Traditional Audits Fail**: Accessibility consulting firms charge $30,000 for a static PDF that expires on your next code push.
- **Interactive VPAT Hub**: Navigate to `/reports` to access the live VPAT 2.5 matrix:
  - Real-time scorecards across all WCAG 2.2 criteria (`Supports`, `Partially Supports`, `Does Not Support`, `Not Applicable`).
  - Instant one-click exports in **HTML**, **Markdown**, **CSV**, and **JSON**.
  - Ready for immediate submission to enterprise procurement and legal teams.

---

### 2.5 Stakeholder Governance & Bias Audits

- **Who It's For**: Compliance officers, executive sponsors, and accessibility champions.
- **Power/Interest Matrix**: Navigate to `/stakeholders` to visually manage champions:
  - *Manage Closely* (High Power, High Interest)
  - *Keep Satisfied* (High Power, Low Interest)
  - *Keep Engaged* (Low Power, High Interest)
  - *Keep Informed* (Low Power, Low Interest)
- **Feedback & Bias Audit**: Log user feedback from individuals with disabilities and review algorithmic bias audits to ensure all disability categories (blind/low vision, motor, cognitive, deaf) receive equitable testing coverage.

---

## 3. Team Member Role Permissions

| Role | Scans & Backlog | AI Copilot | GitHub PR Export | Billing & Org Settings |
| :--- | :---: | :---: | :---: | :---: |
| **Owner** | Full | Full | Full | Full |
| **Admin** | Full | Full | Full | Full |
| **Developer** | Full | Full | Full | Read Only |
| **Auditor** | Full (Read + Signoff) | Read Only | Export Only | Read Only |
| **Viewer** | Read Only | Read Only | None | Read Only |
