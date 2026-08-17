#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env.docker"
DOMAIN=""
STORAGE_DOMAIN=""
LETSENCRYPT_EMAIL=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""

usage() {
  cat <<'USAGE'
Usage (run as root):
  bash deploy/one-click-deploy.sh \
    --domain example.com \
    --email ops@example.com \
    --admin-email admin@example.com \
    [--storage-domain s3.example.com] \
    [--admin-password 'StrongPassword!123']

DNS A/AAAA records for DOMAIN, www.DOMAIN and STORAGE_DOMAIN must point to
this server before the script runs. Ports 80 and 443 must be reachable.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --storage-domain) STORAGE_DOMAIN="${2:-}"; shift 2 ;;
    --email) LETSENCRYPT_EMAIL="${2:-}"; shift 2 ;;
    --admin-email) ADMIN_EMAIL="${2:-}"; shift 2 ;;
    --admin-password) ADMIN_PASSWORD="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ ${EUID:-$(id -u)} -eq 0 ]] || { echo "Run this script as root (sudo)." >&2; exit 1; }
[[ "$DOMAIN" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo "A valid --domain is required." >&2; exit 2; }
[[ "$LETSENCRYPT_EMAIL" == *@* ]] || { echo "A valid --email is required." >&2; exit 2; }
[[ "$ADMIN_EMAIL" == *@* ]] || { echo "A valid --admin-email is required." >&2; exit 2; }
STORAGE_DOMAIN="${STORAGE_DOMAIN:-s3.$DOMAIN}"

if ! command -v curl >/dev/null || ! command -v openssl >/dev/null; then
  if command -v apt-get >/dev/null; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl openssl
  elif command -v dnf >/dev/null; then
    dnf install -y ca-certificates curl openssl
  else
    echo "Install curl and openssl, then rerun this script." >&2
    exit 1
  fi
fi

if ! command -v docker >/dev/null; then
  INSTALLER="$(mktemp)"
  trap 'rm -f "$INSTALLER"' EXIT
  curl -fsSL https://get.docker.com -o "$INSTALLER"
  sh "$INSTALLER"
  rm -f "$INSTALLER"
  trap - EXIT
fi
systemctl enable --now docker 2>/dev/null || true
docker compose version >/dev/null

if [[ ! -f "$ENV_FILE" ]]; then
  POSTGRES_PASSWORD="$(openssl rand -hex 32)"
  MINIO_ROOT_USER="root$(openssl rand -hex 8)"
  MINIO_ROOT_PASSWORD="$(openssl rand -hex 32)"
  STORAGE_ACCESS_KEY_ID="ys$(openssl rand -hex 10)"
  STORAGE_SECRET_ACCESS_KEY="$(openssl rand -hex 32)"
  AUTH_SECRET="$(openssl rand -hex 32)"
  INQUIRY_HASH_SECRET="$(openssl rand -hex 32)"
  CRON_SECRET="$(openssl rand -hex 32)"
  BACKUP_PASSPHRASE="$(openssl rand -hex 48)"
  umask 077
  cat >"$ENV_FILE" <<ENV
POSTGRES_DB=yueshou
POSTGRES_USER=yueshou
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
STORAGE_ACCESS_KEY_ID=$STORAGE_ACCESS_KEY_ID
STORAGE_SECRET_ACCESS_KEY=$STORAGE_SECRET_ACCESS_KEY
STORAGE_BUCKET=yueshou-private-production
AUTH_SECRET=$AUTH_SECRET
INQUIRY_HASH_SECRET=$INQUIRY_HASH_SECRET
CRON_SECRET=$CRON_SECRET
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
SERVER_NAME=$DOMAIN
STORAGE_HOST=$STORAGE_DOMAIN
TLS_CERTS_DIR=/etc/letsencrypt
BACKUP_ENCRYPTION_PASSPHRASE=$BACKUP_PASSPHRASE
BACKUP_INTERVAL_SECONDS=86400
CRON_INTERVAL_SECONDS=300
ENV
  chmod 600 "$ENV_FILE"
else
  echo "Using existing $ENV_FILE; generated secrets will not be replaced."
fi

mkdir -p /etc/letsencrypt "$PROJECT_DIR/deploy/certbot/www"
if [[ ! -s "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  docker run --rm -p 80:80 -v /etc/letsencrypt:/etc/letsencrypt certbot/certbot:latest \
    certonly --standalone --non-interactive --agree-tos --email "$LETSENCRYPT_EMAIL" \
    -d "$DOMAIN" -d "www.$DOMAIN" -d "$STORAGE_DOMAIN"
fi

cd "$PROJECT_DIR"
COMPOSE=(docker compose --env-file "$ENV_FILE")
"${COMPOSE[@]}" config >/dev/null
"${COMPOSE[@]}" build --pull
"${COMPOSE[@]}" run --rm --no-deps validate
"${COMPOSE[@]}" up -d postgres minio
"${COMPOSE[@]}" run --rm migrate

USER_COUNT="$("${COMPOSE[@]}" exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc '\''SELECT count(*) FROM "User";'\''')"
if [[ "$USER_COUNT" == "0" ]]; then
  if [[ -z "$ADMIN_PASSWORD" ]]; then
    ADMIN_PASSWORD="Ys!$(openssl rand -hex 10)aA1"
    GENERATED_ADMIN_PASSWORD=1
  fi
  [[ ${#ADMIN_PASSWORD} -ge 12 ]] || { echo "Admin password must contain at least 12 characters." >&2; exit 2; }
  "${COMPOSE[@]}" run --rm \
    -e INITIAL_ADMIN_EMAIL="$ADMIN_EMAIL" \
    -e INITIAL_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    -e BOOTSTRAP_ADMIN_CONFIRM=I_UNDERSTAND_BOOTSTRAP_ADMIN \
    migrate pnpm db:seed
fi

"${COMPOSE[@]}" up -d --remove-orphans
for attempt in $(seq 1 30); do
  if curl -fsS "https://$DOMAIN/api/ready" >/dev/null; then break; fi
  [[ "$attempt" -lt 30 ]] || { "${COMPOSE[@]}" logs --tail=100 web nginx; exit 1; }
  sleep 2
done
"${COMPOSE[@]}" ps

echo
echo "Deployment complete: https://$DOMAIN"
echo "Admin login: https://$DOMAIN/admin/login"
echo "Admin email: $ADMIN_EMAIL"
if [[ "${GENERATED_ADMIN_PASSWORD:-0}" == "1" ]]; then
  echo "Generated admin password (store it now; it is not written to disk): $ADMIN_PASSWORD"
fi
echo "Secrets: $ENV_FILE (mode 600). Back it up securely."
