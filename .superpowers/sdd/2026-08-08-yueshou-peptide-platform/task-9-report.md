# Task 9 Report: GDPR Cookie Consent and Inquiry Processing

## Status

Complete.

## Implementation

- Added a versioned, timestamped first-party consent cookie containing exactly `necessary` (always true) and opt-in `analytics`. The cookie is written by a Server Action with `HttpOnly`, `Secure`, `SameSite=Lax`, root path, one-year lifetime, and high priority.
- Added localized cookie banner, accessible modal preferences dialog with Escape/focus-trap/focus-return behavior, Reject All, Accept All, saved withdrawal, and a persistent footer Cookie Settings entry.
- Marketing layout parses the consent cookie on the server. The analytics boundary renders only for a valid current-policy value with `analytics: true`; malformed, missing, stale-version, rejected, and withdrawn values fail closed.
- Replaced the request-a-quote placeholder with the semantic client `QuoteForm` island while retaining the database-authored marketing page as a Server Component.
- Added Zod validation for company, contact, fully-qualified email shape (without a free-provider blacklist), country, details, and explicit GDPR consent. Validation, rate-limit, and service errors retain only bounded safe text fields and never echo attachment/private metadata.
- Added a single repository operation that creates `Inquiry` and its explicit `ConsentRecord` through one nested Prisma write. Evidence contains only keyed request/user-agent digests, the explicit-consent marker, policy version, and submission time; raw IP addresses and full inquiry details are absent from evidence and logs.
- Added a narrow persistent PostgreSQL rate-limit adapter with atomic `INSERT ... ON CONFLICT`, keyed HMAC identities for normalized email and IP, and a deterministic in-memory adapter reserved for tests.
- Added private inquiry attachment validation for PDF, DOCX, XLSX, CSV, and TXT through 15 MB; dated random `inquiry/{yyyy}/{mm}/{uuid}.ext` keys; upload intents bound to inquiry/session/actor token hashes, metadata, and expiry; stored-object metadata verification; and atomic one-time consumption. Downloads fail closed until Task 10 supplies authenticated staff authorization and time-limited signing.
- Added the inquiry privacy migration and identical consent/inquiry dictionary trees for English, Simplified Chinese, German, French, and Spanish.

## RED / GREEN Evidence

### Initial consent and inquiry RED

`pnpm vitest run tests/consent.test.tsx tests/inquiries.test.ts`

- RED: both suites failed import resolution because the consent components/preferences and inquiry actions/rate-limit/attachment modules did not exist.

### Focused GREEN

`pnpm vitest run tests/consent.test.tsx tests/inquiries.test.ts`

- GREEN: 2 files passed; 19 tests passed after the unsaved-dialog regression round.
- Consent coverage: no pre-opt-in analytics, current policy/timestamp round trip, reject-all necessary-only storage, withdrawal, required necessary category, dialog Escape behavior.
- Inquiry coverage: field validation, fully-qualified and free-provider email acceptance, atomic inquiry/consent repository contract, minimized evidence, safe-field retention, deterministic IP/email rate limits, attachment allowlist/limit/private key/bindings/one-time consumption, and fail-closed downloads.

### Integration RED / GREEN

- RED: the existing dictionary parity suite rejected the new keys until all five languages and the canonical tree were updated.
- RED: the full suite exposed five homepage harness failures after the layout began using the required request-scoped `cookies()` API.
- GREEN: dictionary parity passed and the homepage harness now uses a deterministic empty cookie store.
- RED: the first production build rejected server-only headers/Prisma dependencies entering the QuoteForm client graph.
- GREEN: the pure inquiry service and persistent repository were separated from the top-level `"use server"` action module; the production build then compiled successfully.
- RED: completion review found that closing an unsaved analytics draft could make the reopened dialog contradict the still-active cookie.
- GREEN: persisted and draft analytics state are now separate; closing discards edits, and the focused regression passes.

## Full Verification

Fresh gates on the final implementation tree:

```text
pnpm test
19 files passed, 3 skipped; 179 tests passed, 5 skipped

pnpm lint
Exit 0; final warning-free rerun recorded before commit

pnpm exec tsc --noEmit
Exit 0

pnpm exec prisma validate
Schema valid

pnpm build
Exit 0; compilation, TypeScript, and 41 pages passed

git diff --check
Exit 0
```

The skipped tests are existing environment-gated integration tests. Build and Prisma validation used disposable syntactically valid environment values and did not connect to a database.

## Commit

- `64fde95 feat: add GDPR consent and inquiries`

## Self-review

- Confirmed no process-local production limiter, raw IP persistence, sensitive inquiry logging, attachment token echo, object-store credentials, analytics-before-opt-in path, or download authorization fallback.
- Confirmed inquiry/consent persistence is one database write, upload intent consumption is concurrency-guarded, and the public QuoteForm/client boundary does not import Prisma or request headers.
- Confirmed all added locale dictionaries have the identical nested key tree and the marketing page remains server-rendered around the client form island.
- Completion review also prompted separate inquiry ID/capability/session/actor bindings and last-hop forwarded-address parsing to avoid treating a prepended forwarding value as the client identity.

## Concerns

- The persistent rate-limit SQL, inquiry transaction, and attachment intent transaction are unit-tested through their narrow contracts and validated by Prisma, but a live PostgreSQL/ObjectStorage integration run depends on deployment infrastructure and is not exercised in this environment.
- Attachment upload/download route wiring is intentionally deferred: the safety service and persistence contract are present, while downloads always deny access until Task 10 adds authenticated staff-only time-limited URL issuance.
