# YueShou peptide platform

YueShou is a five-language peptide-research marketing site and CMS. It uses
Next.js App Router SSR, Ant Design administration, PostgreSQL, a private
S3-compatible storage layer, Auth.js credentials, consent management,
revision-bound legal publication controls, and audit logging.

The public site is locale-prefixed (`/en`, `/zh-CN`, `/de`, `/fr`, `/es`),
with `/` redirecting to English. Public content is server-rendered for semantic
HTML, canonical and alternate metadata, JSON-LD, sitemap, and robots support.
When a requested database translation is missing, the rendered content keeps
the English `lang`, shows a localized fallback notice, and uses the resolved
content language in metadata.

## Prerequisites

- Node.js compatible with Next.js 16 and pnpm 10.30.3.
- PostgreSQL for the application and a private R2/MinIO-compatible bucket for
  uploads.
- Chromium installed by Playwright for browser tests:

  ```sh
  pnpm test:e2e:install
  ```

Copy `.env.example` to an ignored local environment file and use
non-production credentials. Do not put deployment secrets in Git.
`DATABASE_URL` is the application runtime URL; `DIRECT_URL` is for controlled
Prisma migrations only.

## Local commands

```sh
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma validate
pnpm lint
pnpm vitest run
pnpm dev
```

Production builds require a complete, valid environment:

```sh
pnpm build:production
```

For a new database, apply migrations before seeding:

```sh
pnpm db:migrate:deploy
pnpm db:seed
```

The ordinary seed is create-if-missing. It supplies eight editable core pages,
four services, eight home section types, navigation, brand defaults, and five
draft legal pages in all five locales. It does not overwrite, republish,
resurrect, or translate over an existing editorial row. Existing legal rows
receive no seed writes. Operators can manage generic pages at `/admin/content`,
services at `/admin/services`, and page relationships through labelled entity
and media pickers instead of copying database IDs.

Legal pages are different from ordinary content. Approval is tied to the
page's exact `contentRevision`, can be recorded only by an active `ADMIN`, and
is audited. A legal slug, translation, section, or section-translation change
automatically returns the page to `DRAFT`/`PENDING`, clears the reviewer fields,
and advances the revision. Publication and sitemap inclusion require the
reviewed revision to equal the current revision. Repository controls do not
replace written counsel/compliance approval.

## Upload and maintenance boundary

CMS images are not trusted from browser metadata. Completion reads and decodes
the actual bytes, verifies file magic and decoded type, enforces the 10 MiB,
8,192-pixel-per-dimension, and 40-megapixel ceilings, rejects animation, applies
orientation, re-encodes without source metadata, and persists measured type,
size, width, and height.

Expired media/inquiry upload intents, abandoned upload sessions, expired
rate-limit rows, and failed temporary/final objects are handled by durable,
bounded maintenance jobs. Deletion uses leases, re-checks live media,
attachment, and unconsumed-intent references immediately before storage I/O,
retries with capped exponential backoff, and dead-letters after eight attempts.
Object-store lifecycle rules are defense in depth only and may expire only the
exact `media/pending/` and `inquiry/tmp/` staging prefixes. Never target
`media/<year>/<month>/...`, `inquiry/final/`, or the broad `inquiry/` prefix.
Legacy `inquiry/<year>/<month>/...` staging keys remain parser-compatible for
upgrades but are reclaimed by durable jobs, not a broad lifecycle rule.

## Browser release journeys

`pnpm test:e2e` is intentionally safe by default. It does not use a generic
`DATABASE_URL`, does not start a server, and reports the real browser journeys
as skipped until an explicitly disposable PostgreSQL and S3-compatible fixture
is configured. This prevents a release gate from touching development or
production data.

`pnpm test:e2e:release` is fail-closed. It requires:

```text
E2E_REQUIRED=1
E2E_MUTATION_TESTS=1
E2E_CONFIRM_DATABASE_RESET=RESET_YUESHOU_E2E
E2E_DATABASE_URL=postgresql://.../yueshou_e2e
E2E_AUTH_SECRET=<test-only secret of at least 32 characters>
E2E_INQUIRY_HASH_SECRET=<different test-only secret of at least 32 characters>
E2E_STORAGE_ENDPOINT=https://minio-e2e.example.test
E2E_STORAGE_BUCKET=yueshou-e2e
E2E_STORAGE_ACCESS_KEY_ID=<test-only access key>
E2E_STORAGE_SECRET_ACCESS_KEY=<test-only secret key>
E2E_ADMIN_EMAIL=admin-e2e@example.test
E2E_ADMIN_PASSWORD=<test-only administrator password>
```

Optional values are `E2E_STORAGE_REGION`, `E2E_SITE_URL`, and
`E2E_SEARCH_TERM`. The validator rejects database/storage hosts that look like
production, requires the database name to end in `_e2e`, and requires the
bucket name to be explicitly marked for E2E. No media, page, or article IDs are
accepted from the environment.

Provision the durable trust marker once as a PostgreSQL owner/superuser before
the first run, replacing the identifier with the exact `_e2e` database name:

```sql
COMMENT ON DATABASE yueshou_e2e IS 'YUESHOU_E2E_RELEASE';
```

Setup and teardown both authenticate that database-level marker, then execute
the same deterministic lifecycle:

1. `prisma migrate reset --force` on the marked `_e2e` database.
2. `pnpm db:seed` for the ordinary administrator and content baseline.
3. `pnpm db:seed:e2e` for explicit published pages, four services, one product,
   one article, five disposable approved legal pages, and four real PNG storage
   objects under `e2e/fixtures/`.
4. Resolve the newly created media/page/article IDs by stable slug/storage key
   and write a private `test-results/e2e-release-fixture.json` for Playwright.

This order means a reset never invalidates externally supplied identifiers.
Teardown leaves the same migrated, seeded baseline for the next release run.
The disposable legal fixtures are test data only and are not production legal
approval.

```sh
pnpm test:e2e:release
pnpm test:release
```

The Playwright suite covers five-language SSR, locale switching, approved
footer policies, search, live cookie-consent changes, inquiry validation and
submission, admin authentication, responsive keyboard navigation,
accessibility, and the opt-in mutation/publication scenario. Browser checks run
against a production standalone build rather than the development server.

## Deployment and operations

Choose one supported production path:

- Managed Vercel + Supabase PostgreSQL + Cloudflare R2:
  [deployment guide](docs/deployment/vercel-supabase-r2.md)
- Self-hosted Docker + PostgreSQL + MinIO + Nginx:
  [deployment guide](docs/deployment/docker.md)

Use the [content release checklist](docs/operations/content-release-checklist.md)
for every public update. Legal pages require documented counsel/compliance
approval; use the [legal review checklist](docs/operations/legal-review-checklist.md)
before making them public.

## Safety boundaries

- Products and public claims are Research Use Only unless the responsible team
  has separately approved another use.
- Private inquiry attachments are never public media; staff downloads require
  authorization and audit logging.
- Invalid quote submissions return structured field errors and retain only safe
  text fields; they do not create upload sessions or storage work.
- Legal, privacy, shipping, and RUO text is a company/counsel responsibility;
  this repository enforces revision/review/publication controls but is not legal
  advice.
- No cloud resources, DNS, TLS, production secrets, provider schedules,
  production migrations, Docker runtime, live storage, or legal acceptance are
  established merely by running this repository.
