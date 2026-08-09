# Self-hosted Docker deployment

This deployment runs the public Next.js site, PostgreSQL, private MinIO object
storage, Nginx, database migrations, a signed internal cron worker, and encrypted
backups on one Docker host. It is intended for a maintained Linux server behind a
domain name. It does not provision DNS, certificates, off-host backup storage, or
legal approval.

## Prerequisites

- Docker Engine and Docker Compose v2 on a supported Linux host.
- DNS records for both the public site (`SERVER_NAME`) and private S3 gateway
  (`STORAGE_HOST`) hostnames. One TLS certificate pair named `fullchain.pem` and
  `privkey.pem` must cover both names as SANs, in a dedicated host directory.
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
   Set `NEXT_PUBLIC_SITE_URL` and `SERVER_NAME` to the exact HTTPS canonical site
   host, and set `STORAGE_HOST` to a separate HTTPS S3 gateway host (for example,
   `s3.example.com`). Set `TLS_CERTS_DIR` to an absolute directory containing the
   SAN certificate pair. Never commit this file.

   The production validator rejects placeholders, weak/repeating secrets,
   duplicate auth/inquiry/cron or storage/backup credentials, application use
   of the MinIO root identity, invalid PostgreSQL identifiers, an invalid
   bucket, non-positive intervals, non-HTTPS/mismatched site hosts, a shared
   site/storage hostname, and a non-absolute or root TLS directory. The three
   application secrets must be distinct 64-character hexadecimal values.
   MinIO/application/backup secrets must meet the documented length and
   diversity checks; passing Compose interpolation alone is not sufficient.

3. Restrict certificate access to the Docker operator, then render Compose,
   build, and run the production validator before starting stateful work:

   ```sh
   docker compose --env-file .env.docker config
   docker compose --env-file .env.docker build --pull
   docker compose --env-file .env.docker run --rm --no-deps validate
   docker compose --env-file .env.docker up -d postgres minio minio-init migrate
   docker compose --env-file .env.docker up -d
   docker compose --env-file .env.docker ps
   ```

   The `validate` container must exit 0. `minio-init`, `migrate`, `web`, `cron`,
   and `backup` also depend on its successful completion, so a committed
   placeholder cannot reach migration or application startup. `migrate` and
   `minio-init` are expected to exit 0; `web` waits for them before accepting
   traffic. Nginx is the only published surface and redirects HTTP to HTTPS.

   Review migration SQL before this step. The legal-revision migration
   deliberately demotes every historic legal approval to `DRAFT`/`PENDING`,
   because the previous schema could not bind approval to child content. The
   policies must be reviewed and approved again at their exact new revision.

4. Perform the one-time, explicit administrator bootstrap described in the main
   deployment instructions, then remove bootstrap variables. Verify a private
   inquiry attachment cannot be fetched anonymously and that a staff download is
   logged.

## Storage, network, and scheduled work

MinIO is initialized with a private bucket: public anonymous access is disabled,
the application gets bucket-scoped S3 permissions, and browser upload CORS allows
only `NEXT_PUBLIC_SITE_URL`. Browser presigned uploads use
`https://STORAGE_HOST`, which Nginx proxies privately to MinIO without publishing
port 9000. The MinIO root credential is available only to MinIO and its one-shot
initializer; it is never provided to the web, cron, migration, or backup service.
Changing either hostname requires re-running `minio-init` after reviewing CORS.

`STORAGE_HOST` must resolve publicly to the Docker host for browser uploads. Inside
the private Compose network it is an alias for Nginx, so the `web` container uses
the same HTTPS/SNI/Host route without a public-DNS hairpin or host loopback
dependency. Do not map MinIO's API or console to a host port. The certificate must
present a matching SAN for the S3 gateway hostname as well as the website hostname.

The `cron` service makes only private-network `POST` calls to the internal content
publication, archived-media deletion, and storage-maintenance routes. Each call
uses a short-lived HMAC generated from `CRON_SECRET`. Nginx explicitly returns
`404` for every `/api/internal/` request, so these routes are reachable only from
the private Compose network. The interval defaults to five minutes and can be
adjusted with `CRON_INTERVAL_SECONDS`. The cron loop holds the shared media
operations lock while it runs; the backup job holds the corresponding exclusive
lock through its PostgreSQL dump and MinIO mirror. No Docker socket is mounted
into either service.

Storage maintenance sweeps at most 100 expired media/inquiry intents, orphaned
inquiry sessions, and expired login/inquiry rate-limit rows per invocation, then
processes at most 25 deletion jobs. Deletion claims use five-minute leases,
reference checks immediately before object removal, exponential retry capped at
24 hours, eight-attempt dead-lettering, privacy-sanitized errors, and audit events.
Monitor `StorageDeletionJob`, `MediaDeletionJob`, and the associated audit actions;
do not clear a dead letter by deleting an object without first establishing why
the reference-safe worker failed.

### MinIO lifecycle defense

The database-backed worker is the primary cleanup mechanism. MinIO lifecycle is
only a delayed defense for upload staging. Configure abort of incomplete multipart
uploads and, if an expiration rule is used, keep its age comfortably longer than
the 15-minute upload intent plus expected worker recovery. Expiration may target
only the exact `media/pending/` and `inquiry/tmp/` prefixes. Never target broad
`media/` or `inquiry/` prefixes, final `media/<year>/<month>/...`, or
`inquiry/final/...`; a MinIO lifecycle action cannot perform the worker's live
database reference check. Legacy `inquiry/<year>/<month>/...` staging keys remain
parser-compatible for upgrades and must be reclaimed through durable jobs, not a
broad lifecycle rule. Re-audit the rules after any storage-key migration.

Nginx limits request bodies to 20 MB, passes the socket client IP as the single
trusted `X-Forwarded-For` value, sets HTTPS security headers, and applies immutable
caching to Next static assets. The Content Security Policy permits the inline
styles/scripts currently required by Next.js and Ant Design; review it whenever
third-party content is introduced. Confirm an external request to a representative
`/api/internal/...` path receives the indistinguishable `404` response.

## Updates and rollback

Before an update, make and verify a backup. Keep the previous Git tag and image
cache until the release is accepted.

```sh
git fetch --tags
git checkout <new-approved-tag>
docker compose --env-file .env.docker build --pull
docker compose --env-file .env.docker run --rm --no-deps validate
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
a PostgreSQL custom dump and a mirrored MinIO bucket into a hidden work directory
under an exclusive media-operation lock, compresses and encrypts it with AES-256
and PBKDF2, verifies a SHA-256 manifest and archive contents, then atomically
renames a `COMPLETE` timestamp directory. Only complete directories count toward
the newest-30 retention policy. Uploads that begin after the database dump may be
present as unreferenced extra objects; this is safe and recorded in backup metadata.
The encrypted Docker `backup_data` volume is **not** an off-host disaster-recovery
strategy: copy verified encrypted archives to an access-controlled external
destination.

Run a manual backup from PowerShell:

```powershell
./deploy/backup/backup.ps1
```

or Linux:

```sh
docker compose --env-file .env.docker run --rm --no-deps --entrypoint /backup/backup.sh backup
```

The restore command requires a timestamp directory, an explicitly supplied target
PostgreSQL URL, and the literal confirmation `RESTORE`. It accepts only an atomic
`COMPLETE` directory and verifies the archive checksum, decryption, and tar
readability before destructive database work. Restore to a separate database first:

```powershell
./deploy/backup/restore.ps1 `
  -BackupDirectory /backups/2026-08-09T01-00-00Z `
  -TargetDatabaseUrl 'postgresql://restore-user:encoded-password@restore-host:5432/yueshou_restore' `
  -ConfirmRestore RESTORE
```

Linux uses the same explicit entrypoint form:

```sh
docker compose --env-file .env.docker run --rm --no-deps --entrypoint /backup/restore.sh \
  -e 'DATABASE_URL=postgresql://restore-user:encoded-password@restore-host:5432/yueshou_restore' \
  -e RESTORE_CONFIRM=RESTORE backup /backups/2026-08-09T01-00-00Z
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
docker compose --env-file .env.docker run --rm --no-deps validate
```

Do not run `docker compose down -v` in production: it removes persistent data
volumes. Use normal `down` only during a planned outage, and never delete a named
volume until backups have been restored and independently verified.
