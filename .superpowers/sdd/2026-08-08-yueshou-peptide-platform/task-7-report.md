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
