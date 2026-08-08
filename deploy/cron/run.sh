#!/bin/sh
set -eu

: "${CRON_SECRET:?CRON_SECRET is required}"
: "${CRON_INTERVAL_SECONDS:=300}"

while true; do
  node /app/deploy/cron/runner.mjs
  sleep "$CRON_INTERVAL_SECONDS"
done
