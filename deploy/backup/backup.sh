#!/usr/bin/env bash
set -euo pipefail

require() { [[ -n "${!1:-}" ]] || { echo "$1 is required" >&2; exit 64; }; }
for key in DATABASE_URL STORAGE_ENDPOINT STORAGE_BUCKET STORAGE_ACCESS_KEY_ID STORAGE_SECRET_ACCESS_KEY BACKUP_ENCRYPTION_PASSPHRASE; do require "$key"; done

backup_root="${BACKUP_ROOT:-/backups}"
retention_days="${BACKUP_RETENTION_DAYS:-30}"
timestamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
final_dir="${backup_root}/${timestamp}"
work_parent="${backup_root}/.work"
work_dir="${work_parent}/${timestamp}-$$"
lock_file="${OPERATIONS_LOCK_FILE:-/operations-lock/media-deletion.lock}"

[[ "$backup_root" == /backups && "$final_dir" == /backups/* && "$work_dir" == /backups/.work/* ]] || { echo "Backup paths must remain inside /backups" >&2; exit 64; }
[[ "$lock_file" == /operations-lock/* ]] || { echo "OPERATIONS_LOCK_FILE must be inside /operations-lock" >&2; exit 64; }
[[ "$retention_days" =~ ^[1-9][0-9]*$ ]] || { echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2; exit 64; }
mkdir -p "$work_parent"
if [[ -e "$final_dir" ]]; then echo "Refusing to overwrite existing backup $final_dir" >&2; exit 73; fi
mkdir "$work_dir"
umask 077

cleanup() {
  # The work path is generated here and never points outside the backup volume.
  [[ -n "${work_dir:-}" && "$work_dir" == /backups/.work/* && -d "$work_dir" ]] && rm -rf -- "$work_dir"
  return 0
}
trap cleanup EXIT

# The exclusive lock covers both physical snapshot operations. A later upload can
# become an unreferenced extra object, which is safe and recorded below.
exec 9>"$lock_file"
flock -x 9
pg_dump "$DATABASE_URL" --format=custom --compress=9 --file "$work_dir/postgres.dump"
mc alias set backup-minio "$STORAGE_ENDPOINT" "$STORAGE_ACCESS_KEY_ID" "$STORAGE_SECRET_ACCESS_KEY" >/dev/null
mkdir -p "$work_dir/minio"
mc mirror --overwrite --preserve "backup-minio/${STORAGE_BUCKET}" "$work_dir/minio"
printf '%s\n' \
  "created_at=$timestamp" \
  "storage_bucket=$STORAGE_BUCKET" \
  "snapshot_order=postgres_then_minio_under_exclusive_lock" \
  "concurrency_note=uploads_after_database_dump_may_be_unreferenced_extra_objects" > "$work_dir/metadata.env"
flock -u 9

tar -C "$work_dir" -czf "$work_dir/backup.tar.gz" postgres.dump minio metadata.env
tar -tzf "$work_dir/backup.tar.gz" >/dev/null
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
  -in "$work_dir/backup.tar.gz" -out "$work_dir/backup.tar.gz.enc" \
  -pass env:BACKUP_ENCRYPTION_PASSPHRASE
rm -f -- "$work_dir/backup.tar.gz"
(cd "$work_dir" && sha256sum backup.tar.gz.enc > checksums.sha256 && sha256sum --check checksums.sha256)
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "$work_dir/backup.tar.gz.enc" \
  -out "$work_dir/verify.tar.gz" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
tar -tzf "$work_dir/verify.tar.gz" >/dev/null
rm -f -- "$work_dir/verify.tar.gz"
touch "$work_dir/COMPLETE"
mv -T "$work_dir" "$final_dir"
work_dir=""

# Retention only considers atomically completed archive directories.
mapfile -t old_backups < <(find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??T??-??-??Z' -exec test -f '{}/COMPLETE' \; -printf '%f\n' | sort | head -n -"$retention_days")
for old in "${old_backups[@]:-}"; do
  candidate="$backup_root/$old"
  [[ "$candidate" == /backups/* && "$old" =~ ^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z$ ]] || continue
  rm -rf -- "$candidate"
done

echo "Encrypted backup verified at $final_dir"
