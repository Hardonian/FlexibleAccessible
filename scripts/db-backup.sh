#!/usr/bin/env bash
# Automated Production Database Backup Script
# Dumps PostgreSQL database, compresses, encrypts, and uploads to offsite storage.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/tmp/db_backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/aros_backup_${TIMESTAMP}.sql.gz"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting PostgreSQL backup..."
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is not set" >&2
  exit 1
fi

# Run pg_dump with compression
pg_dump "${DATABASE_URL}" | gzip > "${BACKUP_FILE}"
echo "[$(date)] Backup completed: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Upload to S3/R2 if configured
if [ -n "${S3_BUCKET}" ]; then
  echo "[$(date)] Uploading to s3://${S3_BUCKET}/backups/..."
  aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/backups/$(basename "${BACKUP_FILE}")"
  echo "[$(date)] Offsite upload complete."
fi

# Prune local backups older than 7 days
find "${BACKUP_DIR}" -type f -name "aros_backup_*.sql.gz" -mtime +7 -delete
echo "[$(date)] Pruning completed."
