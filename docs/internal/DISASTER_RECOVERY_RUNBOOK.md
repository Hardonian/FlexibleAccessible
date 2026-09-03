# AROS: Disaster Recovery & Incident Response Runbook

Operational procedures for recovery from infrastructure failures, data loss, and worker outages.

---

## 1. Recovery Objectives

- **Recovery Point Objective (RPO)**: < 24 hours (daily automated backups to offsite S3/R2 storage).
- **Recovery Time Objective (RTO)**: < 30 minutes for complete service redeployment from scratch.

---

## 2. Infrastructure Failure Procedures

### Scenario A: PostgreSQL Database Crash or Corruption

1. **Provision Fresh PostgreSQL Instance** (or clean existing container):

   ```bash
   docker volume rm docker_postgres_data
   docker compose -f docker/docker-compose.prod.yml up -d postgres
   ```

2. **Download Latest Offsite Backup**:

   ```bash
   aws s3 cp s3://aros-backups/backups/latest.sql.gz /tmp/backup.sql.gz
   gunzip /tmp/backup.sql.gz
   ```

3. **Restore Database**:

   ```bash
   psql "${DATABASE_URL}" < /tmp/backup.sql
   ```

4. **Re-sync Prisma Client**:

   ```bash
   npm run db:generate
   ```

---

### Scenario B: Redis Crash / Queue Eviction

If Redis runs out of memory or crashes:

1. Restart Redis container with LRU policy:

   ```bash
   docker compose -f docker/docker-compose.prod.yml restart redis
   ```

2. **Degraded In-Memory Fallback**:
   The AROS web application automatically degrades to in-process memory rate limiting if Redis is temporarily unreachable (verified in test suite).

3. **Clear Stale Jobs**:
   BullMQ will automatically re-attempt active jobs when the worker reconnects. If a job is permanently stuck, open `/system/operator` and click "Recheck Status" or drain stale locks.

---

### Scenario C: Tenant Data Purge (GDPR / CCPA "Right to Be Forgotten")

When an organization requests complete data deletion:

1. Run the canonical tenant purge script:

   ```typescript
   // In packages/db or admin script:
   await prisma.organization.delete({
     where: { id: targetOrganizationId },
   });
   ```

*Note: Due to Prisma schema `onDelete: Cascade` on sites, findings, suggestions, and audit logs, deleting the organization cleanly purges all associated tenant artifacts without orphan leakage.*

---

## 3. Incident Communication Protocol

When an unplanned outage exceeding 5 minutes occurs:

1. Update `/status` page or your status provider (e.g. BetterStack / Instatus).
2. Use the incident communication template in [`docs/internal/INCIDENT_COMMUNICATION_TEMPLATE.md`](file:///c:/Users/scott/GitHub/FlexibleAccessible/docs/internal/INCIDENT_COMMUNICATION_TEMPLATE.md).
3. Post post-mortem within 24 hours focusing on root cause, resolution, and preventative mitigations.
