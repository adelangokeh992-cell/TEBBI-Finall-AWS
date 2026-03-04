#!/usr/bin/env bash
# Example: run daily backup via API and optionally copy to second location.
# Set in cron: 0 2 * * * /path/to/backup-daily.example.sh
# Requires: BASE_URL, COMPANY_ID, BEARER_TOKEN (or .env), optional BACKUP_SECOND_PATH or S3

set -e
BASE_URL="${BASE_URL:-https://your-tebbi-domain/api}"
COMPANY_ID="${COMPANY_ID:-}"
BEARER_TOKEN="${BEARER_TOKEN:-}"
if [ -z "$COMPANY_ID" ] || [ -z "$BEARER_TOKEN" ]; then
  echo "Set COMPANY_ID and BEARER_TOKEN (or source .env)" >&2
  exit 1
fi
curl -s -X POST -H "Authorization: Bearer $BEARER_TOKEN" "$BASE_URL/companies/$COMPANY_ID/backups"
echo ""
# Optional: export backup to second path (e.g. rsync to another server, or aws s3 cp after fetching)
# BACKUP_SECOND_PATH=/mnt/backups ./backup-daily.example.sh
