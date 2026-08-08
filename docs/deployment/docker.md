# Self-hosted Docker deployment

This deployment runs the public Next.js site, PostgreSQL, private MinIO object
storage, Nginx, database migrations, a signed internal cron worker, and encrypted
backups on one Docker host. It is intended for a maintained Linux server behind a
domain name. It does not provision DNS, certificates, off-host backup storage, or
legal approval.

## Prerequisites

- Docker Engine and Docker Compose v2 on a supported Linux host.
- A DNS record for the production hostname and a TLS certificate pair named
  `fullchain.pem` and `privkey.pem` in a dedicated host directory.
- 4 GB RAM minimum, persistent disks for Docker volumes, and an off-host backup
  replication destination operated by your infrastructure team.
- Firewall permitting TCP 80 and 443 only. PostgreSQL, MinIO, and the Next.js
  server intentionally have no host port mappings.

## First deployment

1. Check out a tagged release and copy the environment template:

   ```sh
   cp .env.docker.example .env.docker
   chmod 600 .env.docker
   ```

2. Replace every `replace-with-...` value. Generate `AUTH_SECRET`,
   `INQUIRY_HASH_SECRET`, and `CRON_SECRET` separately with
   `openssl rand -hex 32`. Use URL-safe or percent-encoded characters in
   `POSTGRES_PASSWORD`, because Compose constructs PostgreSQL connection URLs.
   Set `NEXT_PUBLIC_SITE_URL` to the exact HTTPS canonical URL and `TLS_CERTS_DIR`
   to an absolute directory containing the certificate pair. Never commit this
   file.

3. Restrict certificate access to the Docker operator, then validate and start:

   ```sh
   docker compose --env-file .env.docker config
   docker compose --env-file .env.docker build --pull
   docker compose --env-file .env.docker up -d postgres minio minio-init migrate
   docker compose --env-file .env.docker up -d
   docker compose --env-file .env.docker ps
   ```

   `migrate` and `minio-init` are expected to exit with status 0. `web` waits for
   them before accepting traffic. Nginx is the only published surface, and it
   redirects HTTP to HTTPS.

4. Perform the one-time, explicit administrator bootstrap described in the main
   deployment instructions, then remove bootstrap variables. Verify a private
   inquiry attachment cannot be fetched anonymously and that a staff download is
   logged.

## Storage, network, and scheduled work

MinIO is initialized with a private bucket: public anonymous access is disabled,
the application gets bucket-scoped S3 permissions, and browser upload CORS allows
only `NEXT_PUBLIC_SITE_URL`. Changing the public domain requires re-running
`minio-init` with the new environment after reviewing the CORS policy.

The `cron` service makes only private-network `POST` calls to the internal content
publication and media deletion routes. Each call uses a short-lived HMAC generated
from `CRON_SECRET`; it does not expose a cron endpoint through Nginx. The interval
defaults to five minutes and can be adjusted with `CRON_INTERVAL_SECONDS`.

Nginx limits request bodies to 20 MB, passes the socket client IP as the single
trusted `X-Forwarded-For` value, sets HTTPS security headers, and applies immutable
caching to Next static assets. The Content Security Policy permits the inline
styles/scripts currently required by Next.js and Ant Design; review it whenever
third-party content is introduced.

## Updates and rollback

Before an update, make and verify a backup. Keep the previous Git tag and image
cache until the release is accepted.

```sh
git fetch --tags
git checkout <new-approved-tag>
docker compose --env-file .env.docker build --pull
docker compose --env-file .env.docker up -d postgres minio minio-init migrate
docker compose --env-file .env.docker up -d --remove-orphans
docker compose --env-file .env.docker logs --tail=100 web nginx migrate
```

Prisma migrations are forward-only. Do **not** roll back an application release
across a database migration without a tested restoration plan. For an application-
only rollback, check out the prior compatible tag, build it, and run `up -d`; keep
the database unchanged. For a data rollback, first restore to an isolated database,
validate it, obtain an approved maintenance window, then follow the explicit
restore procedure below.

## Backups and restores

The `backup` service runs once at startup and every 24 hours by default. It writes
a PostgreSQL custom dump and a mirrored MinIO bucket into a timestamped directory,
compresses and encrypts it with AES-256 and PBKDF2, writes a SHA-256 manifest, and
retains the newest 30 daily directories. The encrypted Docker `backup_data` volume
is **not** an off-host disaster-recovery strategy: copy verified encrypted archives
to an access-controlled external destination.

Run a manual backup from PowerShell:

```powershell
./deploy/backup/backup.ps1
```

or Linux:

```sh
docker compose --env-file .env.docker run --rm --no-deps backup /backup/backup.sh
```

The restore command requires a timestamp directory, an explicitly supplied target
PostgreSQL URL, and the literal confirmation `RESTORE`. It verifies the archive
checksum before decrypting. Restore to a separate database first:

```powershell
./deploy/backup/restore.ps1 `
  -BackupDirectory /backups/2026-08-09T01-00-00Z `
  -TargetDatabaseUrl 'postgresql://restore-user:encoded-password@restore-host:5432/yueshou_restore' `
  -ConfirmRestore RESTORE
```

By default restore overwrites objects present in the backup but preserves extra
objects in the destination bucket. Add `-ReplaceMinioObjects` only after an
approved, tested exact-reconciliation plan; it is destructive. Store the backup
passphrase independently from the server—losing it makes the archives unrecoverable.

## Operations checks

```sh
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail=100 web nginx cron backup
docker compose --env-file .env.docker exec postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Do not run `docker compose down -v` in production: it removes persistent data
volumes. Use normal `down` only during a planned outage, and never delete a named
volume until backups have been restored and independently verified.
