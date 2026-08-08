#!/usr/bin/env bash
set -euo pipefail

backup_dir="${1:?Provide an explicit /backups/<timestamp> directory}"
require() { [[ -n "${!1:-}" ]] || { echo "$1 is required" >&2; exit 64; }; }
for key in DATABASE_URL STORAGE_ENDPOINT STORAGE_BUCKET STORAGE_ACCESS_KEY_ID STORAGE_SECRET_ACCESS_KEY BACKUP_ENCRYPTION_PASSPHRASE RESTORE_CONFIRM; do require "$key"; done
[[ "$RESTORE_CONFIRM" == "RESTORE" ]] || { echo "Set RESTORE_CONFIRM=RESTORE after reviewing the target" >&2; exit 64; }
[[ "$backup_dir" =~ ^/backups/20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z$ ]] || { echo "Backup directory must be an explicit timestamp directory inside /backups" >&2; exit 64; }
[[ -f "$backup_dir/backup.tar.gz.enc" && -f "$backup_dir/checksums.sha256" ]] || { echo "Backup archive or checksum manifest is missing" >&2; exit 66; }

(cd "$backup_dir" && sha256sum --check checksums.sha256)
work_dir="/backups/.restore-$(basename "$backup_dir")-$$"
mkdir -p "$work_dir"
cleanup() { [[ "$work_dir" == /backups/.restore-* ]] && rm -rf -- "$work_dir"; }
trap cleanup EXIT

openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "$backup_dir/backup.tar.gz.enc" \
  -out "$work_dir/backup.tar.gz" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
tar -C "$work_dir" -xzf "$work_dir/backup.tar.gz"
[[ -f "$work_dir/postgres.dump" && -d "$work_dir/minio" ]] || { echo "Backup archive is incomplete" >&2; exit 65; }

# The caller supplies DATABASE_URL explicitly and has acknowledged this destructive operation.
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$DATABASE_URL" "$work_dir/postgres.dump"
mc alias set restore-minio "$STORAGE_ENDPOINT" "$STORAGE_ACCESS_KEY_ID" "$STORAGE_SECRET_ACCESS_KEY" >/dev/null
if [[ "${RESTORE_MINIO_REMOVE:-false}" == "true" ]]; then
  mc mirror --overwrite --remove "$work_dir/minio" "restore-minio/${STORAGE_BUCKET}"
else
  mc mirror --overwrite "$work_dir/minio" "restore-minio/${STORAGE_BUCKET}"
fi
echo "Restore completed. Existing objects not present in the backup were preserved unless RESTORE_MINIO_REMOVE=true."
