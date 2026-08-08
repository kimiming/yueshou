# YueShou peptide platform

YueShou is a multilingual (English, Simplified Chinese, German, French, and
Spanish) peptide-research marketing site and CMS. It uses Next.js App Router
SSR, Ant Design administration, PostgreSQL, a private S3-compatible media
layer, NextAuth credentials, consent management, legal-policy publication
controls, and audit logging.

The public site is locale-prefixed (`/en`, `/zh-CN`, `/de`, `/fr`, `/es`),
with `/` redirecting to English. Public content is server rendered for semantic
HTML, canonical/alternate metadata, JSON-LD, sitemap, and robots support.

## Prerequisites

- Node.js compatible with Next.js 16 and pnpm 10.30.3.
- PostgreSQL for the application and a private R2/MinIO-compatible bucket for
  uploads.
- Chromium installed by Playwright for browser tests:

  ```sh
  pnpm test:e2e:install
  ```

Copy `.env.example` to an ignored local environment file and use non-production
credentials. Do not put deployment secrets in Git. `DATABASE_URL` is the
application runtime URL; `DIRECT_URL` is for Prisma migrations only.

## Local commands

```sh
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma validate
pnpm lint
pnpm vitest run
pnpm dev
```

Production builds require a valid environment:

```sh
pnpm build:production
```

## Browser release journeys

`pnpm test:e2e` is intentionally safe by default: it does not use a generic
`DATABASE_URL`, does not start a server, and reports each real browser journey
as skipped until a disposable seeded fixture is explicitly configured. This
prevents a release gate from touching a developer or production database.

`pnpm test:e2e:release` is the release gate. It fails closed unless
`E2E_REQUIRED=1`, `E2E_MUTATION_TESTS=1`,
`E2E_CONFIRM_DATABASE_RESET=RESET_YUESHOU_E2E`, and every fixture value below
is present. It rejects database hosts/names that look production-like, requires
the database name to end in `_e2e`, resets that isolated database before and
after the run, and fails if Playwright skips any journey.

To execute the real production-build browser journeys, provide a resettable
PostgreSQL database seeded with representative published content and an
administrator account, then set these variables in the test shell:

```text
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
`E2E_SEARCH_TERM`. Set `E2E_MUTATION_TESTS=1` only after the fixture is reset
between runs. It also requires an existing published public media ID, home page
ID, article ID, and article slug:

```text
E2E_PUBLIC_MEDIA_ID=<published public MediaAsset cuid>
E2E_HOME_PAGE_ID=<home Page cuid containing a HERO section>
E2E_ARTICLE_ID=<published Article cuid>
E2E_ARTICLE_SLUG=<published article slug>
```

The opt-in journey changes site settings, hero/banner media, and a German
article translation before checking public cache refresh. Never point any
`E2E_*` value at production.

```sh
pnpm test:e2e:release
pnpm test:release
```

The Playwright suite covers five-language SSR home rendering, locale switching,
approved footer policies, search, cookie consent, inquiry validation/submission,
admin authentication, responsive keyboard navigation, accessibility checks, and
the opt-in mutation/publication scenario. Browser checks run against
`pnpm build && pnpm start`, not the development server.

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
- Legal, privacy, shipping, and RUO text is a company/counsel responsibility;
  this repository enforces review/publication controls but is not legal advice.
