#!/bin/sh
set -eu

: "${CRON_SECRET:?CRON_SECRET is required}"
: "${CRON_INTERVAL_SECONDS:=300}"
mkdir -p /operations-lock

while true; do
  # The shared lock spans the entire signed request, so physical backup cannot
  # race an object deletion between its PostgreSQL dump and MinIO mirror.
  flock -s /operations-lock/media-deletion.lock node /app/deploy/ops/cron-runner.mjs
  sleep "$CRON_INTERVAL_SECONDS"
done
