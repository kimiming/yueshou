#!/usr/bin/env bash
set -euo pipefail

destination="${1:?Usage: deploy/backup/export-portable.sh <destination-directory>}"
env_file="${YUESHOU_ENV_FILE:-.env.docker}"

[[ -f "$env_file" ]] || { echo "Environment file not found: $env_file" >&2; exit 66; }
mkdir -p "$destination"
destination="$(cd "$destination" && pwd -P)"

compose=(docker compose --env-file "$env_file")
"${compose[@]}" ps --status running backup | grep -q 'backup' || {
  echo "The backup service is not running" >&2
  exit 69
}

echo "Creating a fresh encrypted PostgreSQL and object-storage snapshot..."
"${compose[@]}" exec -T backup /backup/backup.sh

backup_name="$("${compose[@]}" exec -T backup sh -ec '
  find /backups -mindepth 1 -maxdepth 1 -type d -name "20??-??-??T??-??-??Z" \
    -exec test -f "{}/COMPLETE" \; -printf "%f\n" | sort | tail -1
')"
[[ "$backup_name" =~ ^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z$ ]] || {
  echo "Could not resolve a completed backup" >&2
  exit 65
}

export_dir="$destination/$backup_name"
[[ ! -e "$export_dir" ]] || { echo "Refusing to overwrite $export_dir" >&2; exit 73; }
mkdir "$export_dir"
cleanup() { [[ -d "$export_dir" && ! -f "$export_dir/COMPLETE" ]] && rm -rf -- "$export_dir"; }
trap cleanup EXIT

for file in backup.tar.gz.enc checksums.sha256 COMPLETE; do
  "${compose[@]}" cp "backup:/backups/$backup_name/$file" "$export_dir/$file"
done
(cd "$export_dir" && sha256sum --check checksums.sha256)

git_commit="$(git rev-parse HEAD 2>/dev/null || printf unknown)"
printf '%s\n' \
  "backup=$backup_name" \
  "git_commit=$git_commit" \
  "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$export_dir/transfer.env"
chmod -R go-rwx "$export_dir"

echo "Portable encrypted backup exported to $export_dir"
echo "Copy this directory and the repository commit to the new server. Do not commit the backup to Git."
