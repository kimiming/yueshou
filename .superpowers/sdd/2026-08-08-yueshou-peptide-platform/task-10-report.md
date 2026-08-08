# Task 10 Report: Auth.js, Role Authorization, and Admin Shell

## Outcome

Implemented Auth.js v4 Credentials authentication with JWT sessions, Argon2id password verification, persistent database-backed throttling, active-user/session-version checks, ADMIN/EDITOR authorization, a responsive Ant Design admin shell/dashboard, live media upload authorization, and private inquiry attachment downloads through audited five-minute signed GET URLs.

## RED / GREEN Evidence

- Password: RED imports failed before `lib/auth/password.ts`; GREEN covers matching/wrong passwords and malformed hashes.
- Enumeration and rate limit: RED before credential authorizer/rate-limit implementation; GREEN covers normalized email, one Argon2 verification for unknown and wrong-password paths, generic throttled failure, and persistent pair/email/trusted-IP buckets.
- Session and permissions: RED before permission/session modules; GREEN covers ADMIN/EDITOR permissions, disabled users, role/version changes, unauthenticated access, and server role enforcement.
- Redirects and shell: RED before admin pages/components; GREEN covers guest `/admin` to `/admin/login`, authenticated login-loop avoidance, generic accessible login errors, permission-shaped navigation, and typed dashboard data.
- Media authorization: RED for cross-origin requests and missing runtime actor mapping; GREEN covers freshly checked staff authorization, same-origin POST enforcement, real storage/repository services, and existing ADMIN-only destructive archive service behavior.
- Private downloads: RED for missing route/signed GET adapter; GREEN covers ADMIN/EDITOR access, unauthenticated rejection before metadata lookup, archived/deleted/missing/storage-missing fail-closed behavior, signed five-minute GETs, sanitized download disposition, no-store redirects, and audit records.

## Verification

- `pnpm test`: 228 passed, 5 skipped (29 files; 26 passed, 3 skipped).
- `pnpm exec tsc --noEmit`: passed.
- `pnpm lint`: passed with no warnings.
- `git diff --check`: passed.
- `$env:NEXT_PUBLIC_SITE_URL='https://www.yueshou.test/'; pnpm exec next build --webpack`: passed; 43 static pages generated and all Task 10 routes listed as dynamic.

## Self-review

- No default credentials or storage credentials are exposed.
- JWT claims are limited to subject, role, and user update-version; sensitive authorization re-queries active user state and rejects stale role/version claims.
- UI visibility mirrors permissions but all protected server boundaries enforce authorization independently.
- Auth.js owns CSRF protection for auth endpoints; custom media mutations enforce same-origin.
- No Task 11/12 CRUD editors were added.

## Concern

The unchanged `pnpm build` Turbopack path reproducibly panicked on a stale internal task (`AssetContent::file was canceled`). Workspace policy blocked clearing `.next`. The supported webpack build completed cleanly; the build script was not changed. A valid `NEXT_PUBLIC_SITE_URL` is required by the pre-existing robots/sitemap build path.
