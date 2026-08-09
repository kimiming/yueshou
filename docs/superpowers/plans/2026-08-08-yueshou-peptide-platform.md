# 粤首多肽官网与 CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个面向全球科研客户、支持五语言、SSR/SEO、内容管理、GDPR Cookie 同意和双生产部署方案的粤首多肽官网。

**Architecture:** 单一 Next.js App Router 项目同时承载公开官网、受保护管理后台与服务端写接口。PostgreSQL/Prisma 保存可编辑内容，JSON 保存固定界面词汇；统一 S3 兼容存储接口分别连接 R2 与 MinIO，发布操作通过标签和路径失效刷新服务端内容。

**Tech Stack:** Next.js、TypeScript、Ant Design、PostgreSQL、Prisma、Auth.js、Argon2id、Zod、S3 SDK、Vitest、Testing Library、Playwright、Docker Compose、Nginx

## Global Constraints

- 品牌名称为“粤首”，英文标语必须精确使用 `Precision Peptide Synthesis for Global Scientific Research`。
- 支持 `en`、`zh-CN`、`de`、`fr`、`es`；英文是数据库内容的必填回退语言。
- 不复制参考公司的商标、受版权保护图片、整段原文或不可验证资质。
- 公开内容必须由服务端 HTML 输出；仅轮播、菜单、表单、Cookie 控件等交互岛使用客户端组件。
- 后台路径为 `/admin`，角色仅为 `ADMIN` 与 `EDITOR`。
- 云端方案使用 Vercel + Supabase PostgreSQL + Cloudflare R2。
- 私有部署使用 Next.js + PostgreSQL + MinIO + Nginx 的 Docker Compose。
- 法律模板上线前必须由目标市场律师复核，不得描述为法律意见。

---

## Planned File Structure

```text
app/
  [locale]/
    (marketing)/layout.tsx
    (marketing)/page.tsx
    (marketing)/about/page.tsx
    (marketing)/services/[slug]/page.tsx
    (marketing)/products/[slug]/page.tsx
    (marketing)/news/[slug]/page.tsx
    (marketing)/contact/page.tsx
    (marketing)/request-a-quote/page.tsx
    (marketing)/legal/[slug]/page.tsx
  admin/(auth)/login/page.tsx
  admin/(dashboard)/layout.tsx
  admin/(dashboard)/page.tsx
  admin/(dashboard)/settings/page.tsx
  admin/(dashboard)/pages/[id]/page.tsx
  admin/(dashboard)/products/page.tsx
  admin/(dashboard)/news/page.tsx
  admin/(dashboard)/inquiries/page.tsx
  api/auth/[...nextauth]/route.ts
  api/media/presign/route.ts
  api/media/complete/route.ts
  robots.ts
  sitemap.ts
components/
  marketing/
  admin/
  consent/
features/
  content/
  inquiries/
  media/
  publishing/
  seo/
lib/
  auth/
  db/
  i18n/
  security/
  storage/
messages/{en,zh-CN,de,fr,es}.json
prisma/schema.prisma
prisma/seed.ts
tests/
e2e/
deploy/nginx/
deploy/backup/
Dockerfile
docker-compose.yml
```

### Task 1: Scaffold Next.js, Ant Design, and the Test Harness

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `app/layout.tsx`, `app/globals.css`
- Create: `lib/env.ts`, `vitest.config.ts`, `playwright.config.ts`, `tests/setup.ts`
- Modify: `.gitignore`
- Test: `tests/env.test.ts`

**Interfaces:**
- Produces: `env` validated runtime configuration from `lib/env.ts`.
- Produces: `npm run test`, `npm run test:e2e`, `npm run build`, `npm run lint`.

- [ ] **Step 1: Initialize the approved official Next.js scaffold**

Create an official Next.js App Router project in a temporary sibling directory, then move only the generated application files into this worktree so the existing `docs/` and Git history remain intact. Use TypeScript, ESLint, Tailwind disabled, `src/` disabled, App Router enabled, and the `@/*` import alias:

```powershell
pnpm dlx create-next-app@latest ../yueshou-next-bootstrap --ts --eslint --no-tailwind --app --no-src-dir --import-alias "@/*" --use-pnpm
Get-ChildItem -Force ../yueshou-next-bootstrap | Move-Item -Destination .
Remove-Item -LiteralPath ../yueshou-next-bootstrap -Force
```

This official Next.js scaffold governs over the incompatible vinext/Sites starter because the approved product requires Next.js SSR, Vercel deployment, and a standalone Docker runtime.

- [ ] **Step 2: Install the application and test dependencies**

```powershell
pnpm add antd @ant-design/nextjs-registry zod next-auth @auth/prisma-adapter @prisma/client argon2 @aws-sdk/client-s3 @aws-sdk/s3-request-presigner isomorphic-dompurify
pnpm add -D prisma vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test tsx eslint
```

- [ ] **Step 3: Write the failing environment validation test**

```ts
// tests/env.test.ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("rejects a production configuration without a database URL", () => {
    expect(() => parseEnv({ NODE_ENV: "production", AUTH_SECRET: "12345678901234567890123456789012" }))
      .toThrow("DATABASE_URL");
  });
});
```

- [ ] **Step 4: Run the test and verify the intended failure**

Run: `pnpm vitest run tests/env.test.ts`

Expected: FAIL because `@/lib/env` does not exist.

- [ ] **Step 5: Implement strict runtime environment parsing and the Ant Design registry**

```ts
// lib/env.ts
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_REGION: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

export type AppEnv = z.infer<typeof schema>;
export const parseEnv = (input: Record<string, string | undefined>): AppEnv => schema.parse(input);
```

Wrap `app/layout.tsx` children in `AntdRegistry`, set `lang="en"`, and define the site title and slogan in metadata.

- [ ] **Step 6: Add scripts and verify the baseline**

Run: `pnpm vitest run tests/env.test.ts && pnpm lint && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 7: Commit the scaffold**

```powershell
git add package.json pnpm-lock.yaml app lib tests vitest.config.ts playwright.config.ts tsconfig.json next.config.ts .gitignore
git commit -m "chore: scaffold Next.js peptide platform"
```

### Task 2: Define the PostgreSQL Schema and Seed Safe Initial Content

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `lib/db/prisma.ts`
- Create: `features/content/types.ts`, `features/content/schemas.ts`
- Test: `tests/content-schemas.test.ts`

**Interfaces:**
- Produces: `prisma` singleton.
- Produces: `contentLocaleSchema`, `publishableTranslationSchema`, `pageSectionSchema`.
- Produces: Prisma entities listed in the approved spec, with translation tables and publish states.

- [ ] **Step 1: Write failing content schema tests**

```ts
import { describe, expect, it } from "vitest";
import { publishableTranslationSchema } from "@/features/content/schemas";

describe("publishableTranslationSchema", () => {
  it("requires an English title and body", () => {
    const result = publishableTranslationSchema.safeParse([{ locale: "de", title: "Peptide", body: "Text" }]);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm vitest run tests/content-schemas.test.ts`

Expected: FAIL because the schema module is missing.

- [ ] **Step 3: Implement locale and publication schemas**

```ts
export const localeSchema = z.enum(["en", "zh-CN", "de", "fr", "es"]);
export const translationSchema = z.object({
  locale: localeSchema,
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1),
});
export const publishableTranslationSchema = z.array(translationSchema).superRefine((items, ctx) => {
  if (!items.some((item) => item.locale === "en")) {
    ctx.addIssue({ code: "custom", message: "English translation is required" });
  }
});
```

- [ ] **Step 4: Model relational content and audit data in Prisma**

Use explicit translation tables with `@@unique([entityId, locale])`, a `PublishStatus` enum (`DRAFT`, `PUBLISHED`, `ARCHIVED`), soft-delete timestamps for managed content, and relations for `User`, `AuditLog`, `SiteSetting`, `NavigationItem`, `Page`, `PageSection`, `Service`, `ProductCategory`, `Product`, `ArticleCategory`, `Article`, `Tag`, `MediaAsset`, `Inquiry`, `InquiryAttachment`, and `ConsentRecord`.

- [ ] **Step 5: Seed an administrator, default navigation, legal pages, and original yueshou copy**

The seed reads `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`, hashes with Argon2id, upserts stable slugs, and inserts only original/general claims. It seeds the required legal slugs `terms`, `privacy`, `ruo-policy`, `shipping-compliance`, and `cookie-policy` in all five locales.

- [ ] **Step 6: Generate and test the migration**

Run: `pnpm prisma format && pnpm prisma validate && pnpm prisma migrate dev --name init && pnpm vitest run tests/content-schemas.test.ts`

Expected: Prisma validation and test suite pass.

- [ ] **Step 7: Commit the schema**

```powershell
git add prisma lib/db features/content tests/content-schemas.test.ts
git commit -m "feat: add multilingual content schema"
```

### Task 3: Implement JSON i18n, Locale Routing, and Translation Fallback

**Files:**
- Create: `messages/en.json`, `messages/zh-CN.json`, `messages/de.json`, `messages/fr.json`, `messages/es.json`
- Create: `lib/i18n/config.ts`, `lib/i18n/dictionaries.ts`, `lib/i18n/resolve-translation.ts`
- Create: `proxy.ts`, `app/[locale]/layout.tsx`
- Test: `tests/i18n.test.ts`

**Interfaces:**
- Produces: `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `isLocale(value)`.
- Produces: `getDictionary(locale): Promise<Dictionary>`.
- Produces: `resolveTranslation<T extends { locale: string }>(items, locale): { value: T; usedFallback: boolean }`.

- [ ] **Step 1: Write failing locale and fallback tests**

```ts
import { describe, expect, it } from "vitest";
import { resolveTranslation } from "@/lib/i18n/resolve-translation";

it("falls back to English when German content is missing", () => {
  const result = resolveTranslation([{ locale: "en", title: "Quality" }], "de");
  expect(result).toEqual({ value: { locale: "en", title: "Quality" }, usedFallback: true });
});
```

- [ ] **Step 2: Run the targeted test and verify failure**

Run: `pnpm vitest run tests/i18n.test.ts`

Expected: FAIL because fallback code is missing.

- [ ] **Step 3: Implement typed dictionaries and English fallback**

The five JSON files must expose the exact same key tree. `dictionaries.ts` uses static imports so bundlers can determine available files; it must not build arbitrary file paths from request input.

- [ ] **Step 4: Add locale validation and deterministic routing**

The root request redirects to `/en`; unsupported first path segments return `notFound()`. Do not use IP geolocation. `app/[locale]/layout.tsx` sets the document language and loads the JSON dictionary server-side.

- [ ] **Step 5: Verify dictionaries and route generation**

Run: `pnpm vitest run tests/i18n.test.ts && pnpm build`

Expected: tests pass and all five locale layouts compile.

- [ ] **Step 6: Commit i18n**

```powershell
git add messages lib/i18n proxy.ts app/[locale]/layout.tsx tests/i18n.test.ts
git commit -m "feat: add five-language routing"
```

### Task 4: Build the Content Repository and Publication Cache Boundary

**Files:**
- Create: `features/content/repository.ts`, `features/content/service.ts`, `features/content/view-models.ts`
- Create: `features/publishing/cache.ts`, `features/publishing/actions.ts`
- Test: `tests/content-service.test.ts`, `tests/publishing-cache.test.ts`

**Interfaces:**
- Produces: `getHomePage(locale)`, `getPageBySlug(locale, slug)`, `getPublishedArticle(locale, slug)`, `getPublishedProduct(locale, slug)`.
- Produces: `publishEntity(input, actor)` and `invalidatePublishedEntity(type, slug, locales)`.

- [ ] **Step 1: Write a failing repository contract test using a mocked Prisma client**

Assert that `getPageBySlug("de", "about")` returns German content when present and English content with `usedFallback: true` otherwise, and never returns `DRAFT` rows.

- [ ] **Step 2: Run the tests and verify failure**

Run: `pnpm vitest run tests/content-service.test.ts tests/publishing-cache.test.ts`

Expected: FAIL because repository functions are absent.

- [ ] **Step 3: Implement repository queries and view-model mapping**

Keep Prisma calls inside `repository.ts`. `service.ts` validates locale/slug, chooses translations, maps media, and returns serializable view models; React components receive no Prisma models.

- [ ] **Step 4: Implement audited publication and exact invalidation**

```ts
export function contentTags(type: "page" | "article" | "product", slug: string) {
  return [`${type}:${slug}`, `${type}:list`];
}
```

Publication must update content and create `AuditLog` in one transaction, then invalidate five localized detail paths and the affected list/home tags.

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run tests/content-service.test.ts tests/publishing-cache.test.ts`

Expected: PASS, including draft exclusion and exact tag tests.

- [ ] **Step 6: Commit the content boundary**

```powershell
git add features/content features/publishing tests/content-service.test.ts tests/publishing-cache.test.ts
git commit -m "feat: add server content services"
```

### Task 5: Implement the R2/MinIO Storage Adapter and Media Safety

**Files:**
- Create: `lib/storage/types.ts`, `lib/storage/s3-storage.ts`, `lib/storage/index.ts`
- Create: `features/media/schemas.ts`, `features/media/service.ts`
- Create: `app/api/media/presign/route.ts`, `app/api/media/complete/route.ts`
- Test: `tests/storage-contract.test.ts`, `tests/media-schemas.test.ts`

**Interfaces:**
- Produces: `ObjectStorage.presignUpload`, `ObjectStorage.headObject`, `ObjectStorage.deleteObject`.
- Produces: `createPendingUpload`, `completeUpload`, `archiveMediaAsset`.

- [ ] **Step 1: Write failing upload validation tests**

```ts
expect(uploadSchema.safeParse({ name: "x.svg", type: "image/svg+xml", size: 100 }).success).toBe(false);
expect(uploadSchema.safeParse({ name: "lab.webp", type: "image/webp", size: 2_000_000 }).success).toBe(true);
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run tests/media-schemas.test.ts tests/storage-contract.test.ts`

Expected: FAIL because schemas and adapter do not exist.

- [ ] **Step 3: Implement a single S3-compatible adapter**

Create `S3Client` with endpoint, region, credentials, and `forcePathStyle` from configuration. R2 sets `forcePathStyle=false`; MinIO sets it to `true`. Object keys use `media/{yyyy}/{mm}/{uuid}.{ext}`.

- [ ] **Step 4: Implement presign and completion routes with authorization**

Allow `image/jpeg`, `image/png`, `image/webp`, and `image/avif` up to 25 MB. On completion, verify object metadata before creating `MediaAsset`. Reject unauthenticated and `EDITOR`-forbidden destructive operations.

- [ ] **Step 5: Protect referenced assets from physical deletion**

`archiveMediaAsset` checks page, product, article and setting references. Referenced assets are archived but retained; unreferenced objects enter a 30-day deletion queue.

- [ ] **Step 6: Run storage tests**

Run: `pnpm vitest run tests/media-schemas.test.ts tests/storage-contract.test.ts`

Expected: both R2-like and MinIO-like contract fixtures pass.

- [ ] **Step 7: Commit media storage**

```powershell
git add lib/storage features/media app/api/media tests/media-schemas.test.ts tests/storage-contract.test.ts
git commit -m "feat: add secure media storage"
```

### Task 6: Build the Semantic Marketing Shell and Homepage Modules

**Files:**
- Create: `components/marketing/site-header.tsx`, `primary-navigation.tsx`, `language-switcher.tsx`, `site-footer.tsx`
- Create: `components/marketing/sections/*.tsx`, `components/marketing/article-card.tsx`, `product-card.tsx`
- Create: `app/[locale]/(marketing)/layout.tsx`, `app/[locale]/(marketing)/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/homepage.test.tsx`

**Interfaces:**
- Consumes: `getHomePage(locale)` and JSON dictionary from Tasks 3–4.
- Produces: semantic server-rendered homepage components with no database access.

- [ ] **Step 1: Write a failing semantic homepage test**

```tsx
render(await HomePage({ params: Promise.resolve({ locale: "en" }) }));
expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
expect(screen.getByText("Precision Peptide Synthesis for Global Scientific Research")).toBeInTheDocument();
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm vitest run tests/homepage.test.tsx`

Expected: FAIL because the marketing page does not exist.

- [ ] **Step 3: Implement the global shell**

Use `header`, `nav`, `main`, `address`, and `footer`. Render the database-configured menu in stable sort order, include keyboard-visible focus states, and keep mobile navigation in one small client component.

- [ ] **Step 4: Implement modular homepage sections**

Create server components for Hero, Services, About, Capabilities, Quality, Product Categories, Global Reach, Stats, News, and CTA. Each receives a typed view model and honors `enabled` and `sortOrder`; only Hero carousel controls are client-side.

- [ ] **Step 5: Apply the approved visual direction**

Use Ant Design tokens for navy/blue/teal scientific branding, wide imagery, restrained gradients, generous white space, clear typographic hierarchy, and responsive grids. Use only original/generated or user-authorized assets.

- [ ] **Step 6: Verify semantics and production rendering**

Run: `pnpm vitest run tests/homepage.test.tsx && pnpm build`

Expected: one H1, semantic navigation/footer, visible slogan, and successful build.

- [ ] **Step 7: Commit the homepage**

```powershell
git add components/marketing app/[locale] app/globals.css tests/homepage.test.tsx
git commit -m "feat: build semantic marketing homepage"
```

### Task 7: Add Public Content, Search, Quote, and Legal Routes

**Files:**
- Create: `app/[locale]/(marketing)/about/page.tsx`
- Create: `app/[locale]/(marketing)/services/[slug]/page.tsx`
- Create: `app/[locale]/(marketing)/products/page.tsx`, `products/[slug]/page.tsx`
- Create: `app/[locale]/(marketing)/news/page.tsx`, `news/[slug]/page.tsx`
- Create: `app/[locale]/(marketing)/contact/page.tsx`, `request-a-quote/page.tsx`
- Create: `app/[locale]/(marketing)/legal/[slug]/page.tsx`, `search/page.tsx`
- Create: `features/content/search.ts`, `components/marketing/rich-content.tsx`, `breadcrumbs.tsx`
- Test: `tests/public-routes.test.tsx`, `tests/search.test.ts`

**Interfaces:**
- Consumes: repository view models and dictionary.
- Produces: public product, article, page, legal, contact, quote and search routes.

- [ ] **Step 1: Write failing route tests**

Test that every required legal slug renders an independent `article`, an unknown slug calls `notFound`, product/article drafts do not render, and search matches name, CAS, sequence and application.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run tests/public-routes.test.tsx tests/search.test.ts`

Expected: FAIL because routes are absent.

- [ ] **Step 3: Implement reusable content rendering**

`RichContent` sanitizes stored HTML and maps headings, lists, tables and links to accessible markup. `Breadcrumbs` renders both visible navigation and data consumed by JSON-LD.

- [ ] **Step 4: Implement product, service, news, company, contact and legal routes**

Each route validates locale/slug, fetches only published content, returns `notFound()` when absent, and uses exactly one H1. Legal pages show the stored legal-review notice in the admin only, not as misleading public legal advice.

- [ ] **Step 5: Implement bounded PostgreSQL search**

Normalize a maximum 100-character query and search published translations and product identifiers with a result cap of 30. Escape wildcard characters and use Prisma parameters rather than string-built SQL.

- [ ] **Step 6: Run route tests and build**

Run: `pnpm vitest run tests/public-routes.test.tsx tests/search.test.ts && pnpm build`

Expected: all required public routes compile and tests pass.

- [ ] **Step 7: Commit public routes**

```powershell
git add app/[locale]/\(marketing\) features/content/search.ts components/marketing tests/public-routes.test.tsx tests/search.test.ts
git commit -m "feat: add multilingual public content routes"
```

### Task 8: Add SEO Metadata, Structured Data, Sitemap, and Robots

**Files:**
- Create: `features/seo/metadata.ts`, `features/seo/json-ld.ts`, `components/marketing/seo-json-ld.tsx`
- Create: `app/sitemap.ts`, `app/robots.ts`
- Test: `tests/seo.test.ts`, `tests/sitemap.test.ts`

**Interfaces:**
- Produces: `buildMetadata(input)`, `organizationJsonLd(setting)`, `articleJsonLd(article)`, `breadcrumbJsonLd(items)`.

- [ ] **Step 1: Write failing hreflang and JSON-LD tests**

Assert five locale alternates plus `x-default`, absolute canonical URLs, Organization schema using yueshou, Article publication dates, and exclusion of drafts/admin routes from sitemap.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run tests/seo.test.ts tests/sitemap.test.ts`

Expected: FAIL because SEO helpers are absent.

- [ ] **Step 3: Implement metadata and structured data helpers**

All URLs derive from validated `NEXT_PUBLIC_SITE_URL`. Serialize JSON-LD with `<` escaped as `\u003c`; never concatenate user HTML into a script tag.

- [ ] **Step 4: Attach route metadata and generate sitemap/robots**

Public pages use `generateMetadata`; sitemap includes published pages, services, products and articles for every locale. `robots.ts` disallows `/admin`, `/api`, preview URLs and query-based search results.

- [ ] **Step 5: Run SEO tests and build**

Run: `pnpm vitest run tests/seo.test.ts tests/sitemap.test.ts && pnpm build`

Expected: all SEO assertions pass.

- [ ] **Step 6: Commit SEO**

```powershell
git add features/seo components/marketing/seo-json-ld.tsx app/sitemap.ts app/robots.ts app/[locale] tests/seo.test.ts tests/sitemap.test.ts
git commit -m "feat: add multilingual SEO output"
```

### Task 9: Implement GDPR Cookie Consent and Inquiry Processing

**Files:**
- Create: `components/consent/cookie-consent-banner.tsx`, `cookie-preferences-dialog.tsx`
- Create: `features/inquiries/schemas.ts`, `features/inquiries/actions.ts`, `features/inquiries/rate-limit.ts`
- Create: `components/marketing/quote-form.tsx`
- Test: `tests/consent.test.tsx`, `tests/inquiries.test.ts`

**Interfaces:**
- Produces: versioned `ConsentPreferences` stored in a secure first-party cookie.
- Produces: `submitInquiry(previousState, formData)`.

- [ ] **Step 1: Write failing consent and inquiry tests**

Test that analytics is disabled before opt-in, Reject All stores only necessary consent, withdrawal disables analytics, invalid email/company/consent is rejected, and a valid inquiry creates both `Inquiry` and `ConsentRecord`.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run tests/consent.test.tsx tests/inquiries.test.ts`

Expected: FAIL because components/actions are absent.

- [ ] **Step 3: Implement versioned Cookie consent**

Consent categories are `necessary` and `analytics`; `necessary` is always true. Store policy version and timestamp. Expose “Cookie Settings” in the footer. Analytics components render only when server-parsed preferences include `analytics: true`.

- [ ] **Step 4: Implement secure inquiry submission**

Validate all fields with Zod, require an institutional email-shaped value without blocking valid domains, apply IP/email rate limits, store minimal request metadata, save explicit GDPR consent with policy version, and return field-level errors without losing safe user input.

- [ ] **Step 5: Add attachment handling through the media safety layer**

Allow PDF, DOCX, XLSX, CSV and TXT up to 15 MB, store inquiry attachments in a private bucket prefix, and issue time-limited download URLs only to authorized staff.

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run tests/consent.test.tsx tests/inquiries.test.ts`

Expected: consent gating and inquiry transaction tests pass.

- [ ] **Step 7: Commit privacy and inquiry work**

```powershell
git add components/consent components/marketing/quote-form.tsx features/inquiries tests/consent.test.tsx tests/inquiries.test.ts
git commit -m "feat: add GDPR consent and inquiries"
```

### Task 10: Add Auth.js, Role Authorization, and the Admin Shell

**Files:**
- Create: `lib/auth/config.ts`, `lib/auth/password.ts`, `lib/auth/permissions.ts`, `auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/admin/(auth)/login/page.tsx`, `components/admin/login-form.tsx`
- Create: `app/admin/(dashboard)/layout.tsx`, `app/admin/(dashboard)/page.tsx`
- Test: `tests/auth.test.ts`, `tests/permissions.test.ts`

**Interfaces:**
- Produces: `auth()`, `signIn`, `signOut`.
- Produces: `requireUser()`, `requireRole(...roles)`, `can(user, permission)`.

- [ ] **Step 1: Write failing password and permission tests**

```ts
expect(await verifyPassword(hash, "wrong-password")).toBe(false);
expect(can({ role: "EDITOR" }, "users:manage")).toBe(false);
expect(can({ role: "ADMIN" }, "users:manage")).toBe(true);
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run tests/auth.test.ts tests/permissions.test.ts`

Expected: FAIL because auth modules are missing.

- [ ] **Step 3: Configure Auth.js credentials safely**

Normalize email, look up active users, verify Argon2id hashes, rotate sessions, and return the same error for unknown users and wrong passwords. Add rate limiting keyed by IP and normalized email.

- [ ] **Step 4: Implement server-side authorization**

Every admin layout, Server Action and API route calls `requireUser` or `requireRole`. Use a permission table for content, media, inquiries, settings and users; UI visibility mirrors but never replaces authorization.

- [ ] **Step 5: Build the responsive Ant Design admin shell**

Include side navigation, locale-independent admin UI labels, current-user menu, sign-out, and dashboard cards for drafts, missing translations, inquiries and recent audit entries.

- [ ] **Step 6: Run auth tests and build**

Run: `pnpm vitest run tests/auth.test.ts tests/permissions.test.ts && pnpm build`

Expected: tests pass; `/admin` redirects unauthenticated requests to `/admin/login`.

- [ ] **Step 7: Commit authentication**

```powershell
git add lib/auth auth.ts app/api/auth app/admin components/admin tests/auth.test.ts tests/permissions.test.ts
git commit -m "feat: secure the administration area"
```

### Task 11: Build Admin Editors for Settings, Navigation, Pages, and Media

**Files:**
- Create: `app/admin/(dashboard)/settings/page.tsx`, `actions.ts`
- Create: `app/admin/(dashboard)/navigation/page.tsx`, `actions.ts`
- Create: `app/admin/(dashboard)/pages/[id]/page.tsx`, `actions.ts`
- Create: `app/admin/(dashboard)/media/page.tsx`, `actions.ts`
- Create: `components/admin/translation-tabs.tsx`, `sortable-sections.tsx`, `media-picker.tsx`, `publish-controls.tsx`
- Test: `tests/admin-settings.test.ts`, `tests/admin-pages.test.ts`

**Interfaces:**
- Consumes: auth, content service, media service and publication cache.
- Produces: audited CRUD and publish actions for global/site content.

- [ ] **Step 1: Write failing authorization and validation tests**

Test that unauthenticated writes fail, Editors cannot manage users or destructive settings, English translations are required for publication, duplicate slugs fail, stale version numbers produce a conflict, and successful publishing creates an audit log plus cache invalidation.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run tests/admin-settings.test.ts tests/admin-pages.test.ts`

Expected: FAIL because actions do not exist.

- [ ] **Step 3: Build reusable five-language form primitives**

`TranslationTabs` displays completion state for each locale, keeps English first, and maps deterministic field names. `PublishControls` shows validation errors and supports Draft, Publish and Archive transitions.

- [ ] **Step 4: Implement settings and navigation management**

Support Logo, favicon, company name, slogan, contact details, social links, default SEO, nested menu ordering, visibility and footer columns. Validate external protocols to `https`, `mailto` and `tel`.

- [ ] **Step 5: Implement page-section management**

Support approved section types only. Drag ordering writes integer positions transactionally. Page section content is parsed by its section-specific Zod schema before save and publish.

- [ ] **Step 6: Implement media library management**

Add upload progress, English alt requirement, localized alt overrides, reference count, archive and safe-delete states. Never expose storage credentials to the browser.

- [ ] **Step 7: Run admin tests**

Run: `pnpm vitest run tests/admin-settings.test.ts tests/admin-pages.test.ts`

Expected: validation, authorization, version conflict and auditing tests pass.

- [ ] **Step 8: Commit core CMS editors**

```powershell
git add app/admin components/admin tests/admin-settings.test.ts tests/admin-pages.test.ts
git commit -m "feat: add modular site content editors"
```

### Task 12: Build Product, News, Inquiry, User, and Audit Administration

**Files:**
- Create: `app/admin/(dashboard)/products/**`
- Create: `app/admin/(dashboard)/news/**`
- Create: `app/admin/(dashboard)/inquiries/**`
- Create: `app/admin/(dashboard)/users/**`
- Create: `app/admin/(dashboard)/audit/page.tsx`
- Create: `features/inquiries/export.ts`
- Test: `tests/admin-products.test.ts`, `tests/admin-news.test.ts`, `tests/admin-inquiries.test.ts`

**Interfaces:**
- Produces: audited product/article/category/tag/user actions.
- Produces: `exportInquiriesCsv(filters, actor): Promise<ReadableStream>`.

- [ ] **Step 1: Write failing domain admin tests**

Test product CAS/sequence validation, article scheduled date validation, category deletion prevention when referenced, inquiry status transitions, CSV formula-injection escaping, private attachment authorization, and ADMIN-only user management.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run tests/admin-products.test.ts tests/admin-news.test.ts tests/admin-inquiries.test.ts`

Expected: FAIL because the domain admin actions are absent.

- [ ] **Step 3: Implement product and news editors**

Use searchable tables, draft/published filters, category/tag selectors, media picker, five-language tabs, SEO preview, scheduled publication date storage and explicit publish action. Do not run background scheduling in the web request; provide a protected cron route that publishes due items transactionally.

- [ ] **Step 4: Implement inquiry workflow and safe CSV export**

Statuses are `NEW`, `IN_PROGRESS`, `RESOLVED`, `ARCHIVED`. Internal notes are never included in public responses. CSV cells beginning with `=`, `+`, `-`, or `@` are prefixed with an apostrophe.

- [ ] **Step 5: Implement users and audit views**

Only ADMIN can create, disable or change roles. Prevent an administrator from disabling the last active ADMIN. Audit view is read-only, filterable and paginated.

- [ ] **Step 6: Run domain admin tests and build**

Run: `pnpm vitest run tests/admin-products.test.ts tests/admin-news.test.ts tests/admin-inquiries.test.ts && pnpm build`

Expected: all tests and build pass.

- [ ] **Step 7: Commit domain administration**

```powershell
git add app/admin features/inquiries/export.ts tests/admin-products.test.ts tests/admin-news.test.ts tests/admin-inquiries.test.ts
git commit -m "feat: complete product news and inquiry CMS"
```

### Task 13: Add Vercel, Supabase, and R2 Production Configuration

**Files:**
- Create: `.env.example`, `vercel.json`, `docs/deployment/vercel-supabase-r2.md`
- Modify: `next.config.ts`, `package.json`
- Test: `tests/production-env.test.ts`

**Interfaces:**
- Consumes: the runtime env and storage adapter.
- Produces: documented cloud production configuration and migration command.

- [ ] **Step 1: Write failing production environment tests**

Assert missing database, auth secret, R2 endpoint, bucket, keys or public site URL fails fast, while a complete Supabase/R2 fixture parses.

- [ ] **Step 2: Run test and verify failure**

Run: `pnpm vitest run tests/production-env.test.ts`

Expected: FAIL until all cloud variables are included in the schema/example.

- [ ] **Step 3: Add complete non-secret environment documentation**

`.env.example` lists every key with safe example values. The deployment guide explains Supabase pooled vs direct migration URLs, R2 CORS, Vercel environment scopes, the first admin seed, controlled `prisma migrate deploy`, rollback and backup expectations.

- [ ] **Step 4: Add Vercel runtime configuration**

Set the Node runtime for database and native Argon2 routes, define the protected cron path for due publications, and configure Next Image to accept only the configured R2 public hostname.

- [ ] **Step 5: Verify cloud configuration**

Run: `pnpm vitest run tests/production-env.test.ts && pnpm prisma validate && pnpm build`

Expected: complete fixture passes and production build succeeds.

- [ ] **Step 6: Commit cloud deployment**

```powershell
git add .env.example vercel.json docs/deployment/vercel-supabase-r2.md next.config.ts package.json tests/production-env.test.ts
git commit -m "ops: add Vercel Supabase R2 deployment"
```

### Task 14: Add Docker Compose Deployment with PostgreSQL, MinIO, Nginx, and Backups

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker-compose.yml`
- Create: `deploy/nginx/nginx.conf`, `deploy/nginx/conf.d/site.conf`
- Create: `deploy/backup/backup.ps1`, `deploy/backup/restore.ps1`
- Create: `docs/deployment/docker.md`
- Test: `tests/docker-config.test.ts`

**Interfaces:**
- Produces: services `web`, `postgres`, `minio`, `nginx`, `migrate`, `backup`.
- Produces: repeatable backup and explicit restore workflow.

- [ ] **Step 1: Write a failing Compose configuration test**

Parse `docker-compose.yml` and assert only Nginx publishes host ports, Postgres/MinIO have health checks and named volumes, `web` waits for healthy dependencies, `migrate` runs `prisma migrate deploy`, and all services define restart/logging behavior appropriate to their lifecycle.

- [ ] **Step 2: Run test and verify failure**

Run: `pnpm vitest run tests/docker-config.test.ts`

Expected: FAIL because Compose files are missing.

- [ ] **Step 3: Create the standalone multi-stage Next.js image**

Use a dependency stage, build stage and non-root runtime stage. Copy `.next/standalone`, `.next/static`, `public`, and Prisma runtime files; set `NODE_ENV=production`, expose 3000 and run `node server.js`.

- [ ] **Step 4: Create the production Compose stack**

Use fixed major versions, named volumes `postgres_data`, `minio_data`, `backup_data`, a private application network, secrets from `.env`, health checks, log rotation, one-shot migration service, and an Nginx-only public surface on 80/443.

- [ ] **Step 5: Configure Nginx and security headers**

Proxy to `web:3000`, set forwarded headers, 20 MB body limit, TLS file paths, HSTS only on HTTPS, `X-Content-Type-Options`, `Referrer-Policy`, a tested CSP, and cache rules for immutable Next assets.

- [ ] **Step 6: Implement backup and restore scripts**

The backup job writes timestamped compressed `pg_dump` output plus mirrored MinIO objects, generates checksums, retains 30 daily backups, and exits nonzero on failure. Restore requires an explicit backup directory argument, verifies checksums and refuses to target an unspecified database.

- [ ] **Step 7: Verify the stack**

Run: `pnpm vitest run tests/docker-config.test.ts && docker compose config && docker build -t yueshou-site:test .`

Expected: config renders without missing variables and image builds successfully.

- [ ] **Step 8: Commit self-hosting**

```powershell
git add Dockerfile .dockerignore docker-compose.yml deploy docs/deployment/docker.md tests/docker-config.test.ts
git commit -m "ops: add self-hosted Docker deployment"
```

### Task 15: End-to-End, Accessibility, Browser, and Release Verification

**Files:**
- Create: `e2e/marketing.spec.ts`, `e2e/consent.spec.ts`, `e2e/inquiry.spec.ts`, `e2e/admin-publish.spec.ts`
- Create: `e2e/fixtures/auth.ts`, `e2e/fixtures/database.ts`
- Create: `docs/operations/content-release-checklist.md`, `docs/operations/legal-review-checklist.md`
- Modify: `package.json`, `README.md`

**Interfaces:**
- Consumes: complete application and both production configurations.
- Produces: automated release gate and operator handoff.

- [ ] **Step 1: Write Playwright tests for the critical journeys**

Cover five-language homepage rendering, language switching, footer legal links, Cookie reject/accept/withdraw, valid and invalid inquiries, admin login, Logo/Banner/contact modification, article translation/publication, public cache refresh, product search, keyboard navigation and mobile menu.

- [ ] **Step 2: Run Playwright and capture real failures**

Run: `pnpm playwright test`

Expected: any remaining integration gaps fail with specific route or locator evidence.

- [ ] **Step 3: Fix only evidenced integration defects**

For each failure, reproduce the exact journey, patch the smallest responsible component/service, add or tighten the regression assertion, and rerun the failed spec before the full suite.

- [ ] **Step 4: Perform production build and full automated verification**

Run: `pnpm lint && pnpm vitest run && pnpm playwright test && pnpm prisma validate && pnpm build && docker compose config`

Expected: every command exits 0 with no skipped critical suite.

- [ ] **Step 5: Perform browser QA on the running application**

Inspect desktop and mobile layouts, semantic heading order, keyboard focus, Cookie behavior, public HTML content, admin editing and publication. Confirm there is no horizontal overflow and no console error on critical routes.

- [ ] **Step 6: Validate operational documentation**

Follow the cloud and Docker guides from clean environment files, run a database backup and restore into a separate test database, and confirm private inquiry attachments cannot be fetched anonymously.

- [ ] **Step 7: Commit the release gate**

```powershell
git add e2e docs/operations README.md package.json
git commit -m "test: add full platform release verification"
```

### Task 16: Final Review and Delivery

**Files:**
- Modify: `README.md` only if final verified commands or setup facts differ from the implementation.

**Interfaces:**
- Produces: a clean, tested repository ready for either deployment path.

- [ ] **Step 1: Review every requirement against the implementation**

Check the approved specification sections for public pages, five languages, semantic SSR, SEO, legal pages, Cookie consent, CMS editability, R2/MinIO abstraction, cloud deployment and Docker deployment. Record no unverified success claim.

- [ ] **Step 2: Run the final clean verification**

Run: `pnpm lint && pnpm vitest run && pnpm playwright test && pnpm build && docker compose config && git status --short`

Expected: checks pass and `git status --short` is empty.

- [ ] **Step 3: Review security-sensitive configuration**

Confirm no `.env` secrets, generated credentials, private attachments or production database dumps are tracked. Confirm the initial administrator password is deployment-supplied and the seed does not contain a default password.

- [ ] **Step 4: Commit any documentation-only corrections**

```powershell
git add README.md docs
git commit -m "docs: finalize yueshou platform handoff"
```

Skip this commit when no file changed.

- [ ] **Step 5: Deliver the verified result**

Report implemented capabilities, exact verification results, remaining user-supplied production facts (real Logo, address, email, certifications and legal approval), and both deployment guides without claiming that external cloud resources were provisioned unless they were actually configured.
