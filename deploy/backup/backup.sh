#!/usr/bin/env bash
set -euo pipefail

require() { [[ -n "${!1:-}" ]] || { echo "$1 is required" >&2; exit 64; }; }
for key in DATABASE_URL STORAGE_ENDPOINT STORAGE_BUCKET STORAGE_ACCESS_KEY_ID STORAGE_SECRET_ACCESS_KEY BACKUP_ENCRYPTION_PASSPHRASE; do require "$key"; done

backup_root="${BACKUP_ROOT:-/backups}"
retention_days="${BACKUP_RETENTION_DAYS:-30}"
timestamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
backup_dir="${backup_root}/${timestamp}"
work_dir="${backup_root}/.work-${timestamp}-$$"

[[ "$backup_root" == /backups ]] || { echo "BACKUP_ROOT must be /backups in the container" >&2; exit 64; }
[[ "$retention_days" =~ ^[1-9][0-9]*$ ]] || { echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2; exit 64; }
mkdir -p "$backup_root" "$backup_dir" "$work_dir"
umask 077

cleanup() {
  # The path is generated above and constrained to the mounted backup volume.
  [[ "$work_dir" == "$backup_root/.work-"* ]] && rm -rf -- "$work_dir"
}
trap cleanup EXIT

pg_dump "$DATABASE_URL" --format=custom --compress=9 --file "$work_dir/postgres.dump"
mc alias set backup-minio "$STORAGE_ENDPOINT" "$STORAGE_ACCESS_KEY_ID" "$STORAGE_SECRET_ACCESS_KEY" >/dev/null
mc mirror --overwrite --preserve "backup-minio/${STORAGE_BUCKET}" "$work_dir/minio"
printf 'created_at=%s\nstorage_bucket=%s\n' "$timestamp" "$STORAGE_BUCKET" > "$work_dir/metadata.env"

tar -C "$work_dir" -czf "$backup_dir/backup.tar.gz" postgres.dump minio metadata.env
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
  -in "$backup_dir/backup.tar.gz" -out "$backup_dir/backup.tar.gz.enc" \
  -pass env:BACKUP_ENCRYPTION_PASSPHRASE
rm -f -- "$backup_dir/backup.tar.gz"
(cd "$backup_dir" && sha256sum backup.tar.gz.enc > checksums.sha256)

# Retention is constrained to timestamped immediate children of /backups.
mapfile -t old_backups < <(find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??T??-??-??Z' -printf '%f\n' | sort | head -n -"$retention_days")
for old in "${old_backups[@]:-}"; do
  candidate="$backup_root/$old"
  [[ "$candidate" == "$backup_root/"* && "$old" =~ ^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z$ ]] || continue
  rm -rf -- "$candidate"
done

echo "Encrypted backup verified at $backup_dir"
