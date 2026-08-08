# Task 7 Report: Public Content, Search, Quote, and Legal Routes

## Status

Complete.

## Implementation

- Added localized public routes for About, service detail, Products list/detail, News list/detail, Contact, Request a Quote, the five independent legal policies, and Search.
- Extended the content repository/service boundary for published services, products, and articles. Pages and components do not access Prisma.
- Added typed, deterministic, published-only search across products, services, pages, and articles. Product matching includes translated name/application content, CAS, and sequence. Queries normalize Unicode/whitespace, cap input at 100 characters, escape PostgreSQL LIKE metacharacters, use Prisma parameters, and cap combined results at 30.
- Added strict server-side HTML sanitization with an explicit tag/attribute allowlist, no H1/script/style/iframe/form/embed/object/event/style/javascript URL output, semantic headings/lists/tables, and `noopener noreferrer` for external blank-target links.
- Added breadcrumb view-model data and visible accessible navigation.
- Contact renders only stored site-setting data. Request a Quote exposes the semantic Task 9 form container and localized GDPR notice without submission or consent logic.

## RED / GREEN Evidence

### RED

`pnpm vitest run tests/public-routes.test.tsx tests/search.test.ts`

- Failed because the legal/product/news route modules and `features/content/search.ts` did not exist.

### GREEN

`pnpm vitest run tests/public-routes.test.tsx tests/search.test.ts`

- 2 files passed.
- 15 tests passed.
- Covers all five legal slugs, unknown legal slug rejection, unavailable draft detail rejection, exactly one H1, sanitizer behavior, Unicode/query bounds, wildcard/backslash escaping, product name/CAS/sequence/application matches, published Prisma filters, stable ranking, 30-result cap, and blank-query short circuit.

## Final Verification

Fresh combined gate:

```text
pnpm vitest run
14 files passed, 2 skipped; 114 tests passed, 4 skipped

pnpm lint
0 errors, 0 warnings

pnpm build
Exit 0; compilation and TypeScript passed; all required public routes emitted
```

The four skipped tests are existing environment-gated integration tests.

## Commit

- `c3836b3 feat: add multilingual public content routes`

## Self-review

- Confirmed public pages/components have no Prisma imports and search contains no raw SQL.
- Confirmed every added route has exactly one H1; stored rich content cannot add another H1.
- Confirmed only the required legal slugs are accepted and publication remains governed by the existing repository filters and database legal-review constraint.
- Confirmed no Task 8 metadata/JSON-LD, Task 9 submission/consent behavior, cookie behavior, or admin UI was added.
- Confirmed Contact has no invented address, email, or telephone fallback.

## Concerns

- Legal, contact, quote, list, and company pages intentionally return 404 until their corresponding database records are published; legal publication additionally requires the existing approved-review constraint.

## Review Fix Round 1/5

Base: `ec7ba03`

### Findings addressed

1. Added a legal-only repository/service read boundary. It accepts only the five legal slugs and requires `PUBLISHED`, non-deleted, `legalReviewStatus: APPROVED`, and a non-null `legalReviewedAt`. The legal route no longer uses the generic page reader. Page search applies the same approval requirement so an unapproved legal title/body cannot leak through results.
2. Added the generic `/{locale}/[slug]` CMS page route for non-reserved published page slugs. Search now maps `home` to `/{locale}`, the five legal slugs to `/{locale}/legal/{slug}`, and other CMS pages to `/{locale}/{slug}`.
3. Added a focused public-slug domain validator. Product, news, service, legal, and generic detail routes reject invalid slugs before lookup, return not-found only for invalid/missing/unpublished content, and allow unexpected repository/database/mapping exceptions to propagate.

### RED evidence

- Legal tests failed because `findApprovedLegalPageBySlug` / `getApprovedLegalPageBySlug` did not exist and the legal route still called the generic reader.
- Slug tests failed because the focused public-slug domain module did not exist.
- Generic route/search tests failed because `/{locale}/[slug]` did not exist and `home` mapped to `/{locale}/home`.
- Error-boundary tests failed because product, article, and service routes converted rejected lookups to `NEXT_NOT_FOUND`; invalid detail slugs also reached the service.
- Search defense test failed because page search did not require legal approval metadata.

### GREEN evidence

Focused command:

```text
pnpm vitest run tests/public-routes.test.tsx tests/search.test.ts tests/public-slug.test.ts tests/content-service.test.ts
4 files passed; 46 tests passed
```

Final fresh gate:

```text
pnpm vitest run
15 files passed, 2 skipped; 135 tests passed, 4 skipped

pnpm exec tsc --noEmit
Exit 0

pnpm lint
0 errors, 0 warnings

DATABASE_URL=<disposable-valid-url> pnpm exec prisma validate
Schema valid

pnpm build
Exit 0; compilation and TypeScript passed; /[locale]/[slug] and all static public routes emitted
```

The four skipped tests remain existing environment-gated integration tests. Prisma validation used a disposable syntactically valid URL and did not connect to a database.
