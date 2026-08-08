# Vercel, Supabase PostgreSQL, and Cloudflare R2 deployment

This runbook is for the managed production architecture: Vercel hosts the Next.js application, Supabase hosts PostgreSQL, and Cloudflare R2 stores uploads. It is an operational guide, not legal or compliance advice. Do not place production secrets in Git, browser code, tickets, or screenshots.

## 1. Prepare the environment

Copy `.env.example` to a secret manager and replace every `replace-with-...` value. Run the following from a trusted operator workstation before any production release:

```bash
pnpm env:check:production
```

The validator requires a 32-character minimum for `AUTH_SECRET`, `INQUIRY_HASH_SECRET`, and `CRON_SECRET`; requires `INQUIRY_PROXY_MODE=vercel`; and rejects an `r2.dev` media URL. Generate distinct random values for every secret. `NEXT_PUBLIC_*` variables are public at build time and must never contain credentials.

In Vercel, configure values under **Production** first. Use a separate Supabase project, R2 bucket(s), and non-production secrets for **Preview**; do not point previews at production inquiries, production storage, or production databases. Keep development values in `.env.local`, which remains ignored.

## 2. Supabase PostgreSQL and Prisma

The application has two intentional connection strings:

| Variable | Used by | Connection type |
| --- | --- | --- |
| `DATABASE_URL` | Vercel runtime via `PrismaPg` | Supabase pooled connection (normally port 6543) |
| `DIRECT_URL` | Prisma CLI migration commands | direct database connection (normally port 5432) |

`prisma.config.ts` uses `DIRECT_URL` so `prisma migrate deploy` never attempts DDL through the transaction pooler. The runtime client in `lib/db/prisma.ts` separately reads `DATABASE_URL`. Keep both URLs scoped to the same environment and never swap production with preview.

Release database changes in this order, from a controlled CI job or trusted workstation with production secrets loaded:

```bash
pnpm prisma:generate
pnpm prisma validate
pnpm db:migrate:deploy
```

Do **not** run `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` against production. Do not run migrations in Vercel's regular build command: a failed or concurrent deployment must not race schema changes. Vercel's Build Command is `pnpm build`; it runs `prisma generate` before `next build`.

### First administrator bootstrap

After migrations are complete, set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` temporarily in the one-off operator shell, then run:

```bash
pnpm db:seed
```

`pnpm db:seed` runs `prisma db seed`. The seed uses an email upsert and sets that account to `ADMIN`. Record the operator and time in the deployment change log, remove the two bootstrap values immediately afterward, and sign in through `/admin` to rotate to a long, unique password. Never seed from a public Vercel request or a routine deployment build.

### Backup, migration failure, and rollback

Before `pnpm db:migrate:deploy`, make a verified Supabase backup (or point-in-time recovery marker) and confirm restoration access. A failed deploy with no migration applied can be rolled back by redeploying the prior Vercel deployment. If a migration has applied, do **not** delete migration records or run destructive rollback SQL blindly: pause releases, assess the migration, restore into an isolated Supabase project, rehearse the restore, and use a reviewed forward-fix migration or the provider's documented restore procedure. Test restore and R2 object recovery at least quarterly.

## 3. Cloudflare R2

Create scoped R2 API credentials with access only to the relevant account/bucket, then configure:

```text
STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_BACKEND=r2
```

R2 presigned URLs use the S3 API endpoint; they cannot use an R2 custom domain. Keep `STORAGE_ACCESS_KEY_ID` and `STORAGE_SECRET_ACCESS_KEY` server-only.

### Buckets and delivery boundary

Use separate buckets:

- **Private application bucket** (`STORAGE_BUCKET`): inquiry attachments, upload staging, and all objects handled by the current storage adapter. Keep it private; do not enable a public URL or attach a public custom domain.
- **Public media bucket**: only reviewed public marketing assets. Attach `media.example.com` as the custom domain and set `NEXT_PUBLIC_R2_PUBLIC_URL=https://media.example.com`. Disable the `r2.dev` development URL in production.

The current adapter is deliberately configured with one `STORAGE_BUCKET`, so it must remain the private application bucket. Do not place inquiry attachments in a public bucket. Publishing direct R2 media delivery requires an explicit bucket-aware copy/serving integration before this hostname is used in page content; the Next Image allowlist is not an authorization mechanism.

For the public bucket, use a Cloudflare custom domain in the same Cloudflare zone, enforce HTTPS, and add WAF/cache rules appropriate for public, non-sensitive assets. Do not CNAME an `r2.dev` URL. Cloudflare documents `r2.dev` as development-only; a custom domain is required for production controls.

### R2 CORS

Configure CORS on the **private application bucket** for exactly the application origins that upload through presigned URLs. Include production origin and, only if preview uploads are intentionally enabled, the specific preview origin; never use `*` with credentials or broad wildcard origins.

```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://www.example.com</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>content-type</AllowedHeader>
    <AllowedHeader>x-amz-meta-sha256</AllowedHeader>
    <AllowedHeader>x-amz-checksum-sha256</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

Apply CORS through the R2 dashboard or S3-compatible `PutBucketCors` workflow, then test a real preflight and a presigned upload from the allowed production origin. For the public media bucket, allow only safe `GET`/`HEAD` origins if browser cross-origin access is needed; serving an image does not itself require broad CORS.

## 4. Vercel build, Cron, and probes

Set Vercel's Install Command to `pnpm install --frozen-lockfile` and Build Command to `pnpm build`. Confirm Node.js is supported by the pinned Next.js and native `argon2` release. Database, storage, auth, and cron route handlers export the Node.js runtime; do not switch them to an Edge runtime.

`vercel.json` schedules `GET /api/internal/publish-scheduled` every five minutes. Vercel Cron invokes configured paths with **GET** and sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is configured. The route validates the exact 32+-character bearer secret. Its existing `POST` endpoint retains timestamped HMAC authentication for a separately configured external scheduler; do not turn off POST authentication or use an unauthenticated GET adapter.

Vercel plan limits can restrict cron frequency. If the selected plan cannot run every five minutes, use a trusted external scheduler that sends the documented HMAC POST request to the same endpoint; do not weaken the endpoint to make an unauthenticated scheduler work.

- `GET /api/health` is a liveness probe and does not query PostgreSQL.
- `GET /api/ready` is a readiness probe and returns `503` unless PostgreSQL accepts `SELECT 1`.

Configure external monitoring to request both over HTTPS and alert on non-2xx responses. These responses are `no-store` and intentionally do not expose database details.

## 5. Release checklist

1. Review migration SQL and confirm a current backup/PITR marker.
2. Run `pnpm env:check:production`, `pnpm prisma validate`, tests, lint, and `pnpm build` with production-safe build variables.
3. Run `pnpm db:migrate:deploy` once from the controlled release job.
4. Bootstrap the first administrator only when required, then remove bootstrap credentials.
5. Deploy Vercel, verify `/api/health`, `/api/ready`, a protected Cron invocation, public pages, `/admin`, and a presigned R2 upload.
6. Record versions, migration name, backup marker, operator, and verification results in the release log.

Reference provider guidance: [Vercel Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/), [Cloudflare R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/), and [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
