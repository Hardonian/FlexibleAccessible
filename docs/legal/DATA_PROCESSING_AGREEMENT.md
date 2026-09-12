# Data Processing Agreement (DPA)

**Standard Contractual Clauses & Enterprise Customer Addendum**  
**Effective Date:** September 12, 2026  

This Data Processing Agreement ("DPA") governs the processing of personal data by AROS Inc. ("Processor") on behalf of the customer subscribing to the AROS platform ("Controller"), in compliance with Article 28 of Regulation (EU) 2016/679 (GDPR), UK GDPR, and California Consumer Privacy Act (CCPA).

---

## 1. Subject Matter, Scope & Nature of Processing

- **Subject Matter**: Provision of the AROS accessibility intelligence, headless crawling, defect clustering, and code remediation service.
- **Duration**: Duration of the customer subscription agreement plus required legal retention periods.
- **Nature of Data**: Customer employee login details (name, email, role) and public website DOM artifacts processed during accessibility audits.
- **Categories of Data Subjects**: Customer employees, authorized users, and end-users of Customer's public web surfaces.

---

## 2. Processor Obligations

1. **Processing on Documented Instructions**: Processor shall process personal data solely in accordance with Controller's documented instructions, including with respect to international data transfers.
2. **Confidentiality**: All personnel authorized to process Customer Data are bound by strict confidentiality obligations.
3. **Security Measures (Article 32)**: Processor maintains state-of-the-art technical and organizational measures:
   - Encryption of personal data at rest (AES-256) and in transit (TLS 1.3).
   - AST-enforced tenant boundary isolation preventing cross-tenant data access.
   - Regular automated vulnerability scanning, dependency auditing, and backup integrity drills.
4. **Subprocessor Management**: Controller grants general authorization to engage subprocessors listed in the AROS Subprocessor Directory. Processor will notify Controller at least 30 days prior to any changes.
5. **Data Subject Rights Assistance**: Processor provides automated tooling (`scripts/gdpr-purge-tenant.mjs`) enabling Controller to fulfill data subject requests (access, rectification, deletion, portability) within 72 hours.
6. **Breach Notification SLA**: Processor shall notify Controller without undue delay, and in any event within **48 hours**, upon becoming aware of a confirmed personal data security breach affecting Customer Data.

---

## 3. Data Deletion and Return

Upon termination of the primary agreement, Processor shall, at the choice of Controller, delete or return all Customer Personal Data within 30 calendar days, unless applicable law requires continued storage of the personal data.

---

## 4. Governing Law & Sign-Off

This DPA is incorporated by reference into Customer's Master Services Agreement or online subscription registration.
