# AROS Privacy Policy

**Effective Date:** September 12, 2026  
**Last Updated:** September 12, 2026  

AROS Inc. ("AROS", "we", "our", or "us") is dedicated to safeguarding the privacy of our users, customers, and website visitors. This Privacy Policy describes how we collect, use, disclose, and protect personal data under GDPR (EU/UK) and CCPA/CPRA (California).

---

## 1. Information We Collect

### 1.1 Account & Authentication Information

- **Name and Email Address**: Collected during signup, team invitation, or OIDC single sign-on (SSO).
- **Credentials**: Salted bcrypt password hashes (local accounts) or OIDC Subject/Issuer identifiers (enterprise SSO).
- **Billing Data**: Processed directly by Stripe (PCI-DSS Level 1 certified). We store only Stripe Customer IDs, subscription status, and non-sensitive invoice metadata.

### 1.2 Scan & Operational Telemetry

- **Scanned URLs and Rendered DOM Snippets**: Collected to run Axe-core and generate accessibility remediation recipes.
- **Audit Logs**: Timestamps, IP addresses, user-agent headers, and action descriptions for tenant security trails.
- **Canary & Performance Metrics**: Latency, queue depths, and worker execution statistics.

---

## 2. How We Use Information

- To deliver, maintain, and improve the AROS platform.
- To process automated subscription payments and meter report export credits.
- To prevent abuse, enforce tenant boundary isolation, and block malicious scans.
- To notify operators of scan completions, regressions, and security alerts.

---

## 3. Subprocessors & Data Transfers

We partner with enterprise infrastructure providers that maintain SOC 2 and ISO 27001 certifications:

| Subprocessor | Purpose | Data Location |
| :--- | :--- | :--- |
| **Stripe, Inc.** | Payment processing & invoicing | USA / Global |
| **Cloudflare, Inc.** | CDN, DDoS protection, edge caching | Global Edge |
| **Supabase / AWS / Neon** | Managed PostgreSQL database hosting | USA / EU (Customer selectable) |
| **Postmark / Resend** | Transactional email delivery | USA |
| **Anthropic / OpenAI** | Optional LLM code remediation (Zero data retention agreement) | USA |

---

## 4. Data Retention & Right to be Forgotten (GDPR / CCPA)

- **Retention**: Account information is retained while your workspace is active plus 30 days after cancellation.
- **Automated Purge Tool**: Customers may exercise their Right to be Forgotten by emailing `privacy@aros.dev` or executing the automated tenant purge command (`scripts/gdpr-purge-tenant.mjs`), which deletes all personal identifiable data within 24 hours.

---

## 5. Security Safeguards

- AES-256 encryption at rest for database volumes and offsite snapshots.
- TLS 1.3 encryption in transit for all web traffic and API integrations.
- Role-based access control (RBAC) and AST-enforced tenant isolation boundaries in application code.

---

## 6. Privacy Contact

For privacy requests, DPO inquiries, or deletion requests:

- **Email**: [privacy@aros.dev](mailto:privacy@aros.dev)
- **Data Protection Officer**: [dpo@aros.dev](mailto:dpo@aros.dev)
