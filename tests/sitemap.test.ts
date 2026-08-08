import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import robots from "@/app/robots";
import { buildSitemap, type SitemapContentEntry } from "@/app/sitemap";

describe("public sitemap", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.yueshou.example/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("includes each eligible public route in all five locales with deterministic timestamps", () => {
    const entries: SitemapContentEntry[] = [
      {
        kind: "page",
        slug: "home",
        status: "PUBLISHED",
        deletedAt: null,
        publishedAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
        legalReviewStatus: "NOT_REQUIRED",
        legalReviewedAt: null,
      },
      {
        kind: "service",
        slug: "custom-synthesis",
        status: "PUBLISHED",
        deletedAt: null,
        publishedAt: "2026-07-02T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      },
      {
        kind: "article",
        slug: "research-update",
        status: "PUBLISHED",
        deletedAt: null,
        publishedAt: "2026-07-03T00:00:00.000Z",
        updatedAt: "2026-08-03T00:00:00.000Z",
      },
      {
        kind: "product",
        slug: "bpc-157",
        status: "PUBLISHED",
        deletedAt: null,
        publishedAt: "2026-07-03T00:00:00.000Z",
        updatedAt: "2026-08-03T06:00:00.000Z",
      },
      {
        kind: "page",
        slug: "privacy",
        status: "PUBLISHED",
        deletedAt: null,
        publishedAt: "2026-07-04T00:00:00.000Z",
        updatedAt: "2026-08-04T00:00:00.000Z",
        legalReviewStatus: "APPROVED",
        legalReviewedAt: "2026-07-30T12:00:00.000Z",
      },
    ];

    const sitemap = buildSitemap(entries);

    expect(sitemap).toHaveLength(25);
    expect(sitemap.map((item) => item.url)).toContain(
      "https://www.yueshou.example/zh-CN/services/custom-synthesis",
    );
    expect(sitemap.find((item) => item.url.endsWith("/fr/news/research-update")))
      .toMatchObject({ lastModified: "2026-08-03T00:00:00.000Z" });
    expect(sitemap.find((item) => item.url.endsWith("/es/legal/privacy")))
      .toMatchObject({ lastModified: "2026-07-30T12:00:00.000Z" });
    expect(sitemap.map((item) => item.url)).toContain(
      "https://www.yueshou.example/fr/products/bpc-157",
    );
    expect(sitemap[0]?.alternates?.languages).toEqual({
      en: "https://www.yueshou.example/en",
      "zh-CN": "https://www.yueshou.example/zh-CN",
      de: "https://www.yueshou.example/de",
      fr: "https://www.yueshou.example/fr",
      es: "https://www.yueshou.example/es",
      "x-default": "https://www.yueshou.example/en",
    });
  });

  it.each(["page", "service", "product", "article"] as const)(
    "rejects malformed and unsupported-Unicode %s slugs before URL interpolation",
    (kind) => {
      const entries = ["../admin", "encoded%2Fseparator", "has space", " padded", "研究"]
        .map((slug): SitemapContentEntry => ({
          kind,
          slug,
          status: "PUBLISHED",
          deletedAt: null,
          publishedAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
          ...(kind === "page"
            ? { legalReviewStatus: "NOT_REQUIRED" as const, legalReviewedAt: null }
            : {}),
        }));

      expect(buildSitemap(entries)).toEqual([]);
    },
  );

  it("excludes drafts, deleted records, unreviewed legal pages, and internal/search slugs", () => {
    const unsafeEntries: SitemapContentEntry[] = [
      {
        kind: "article",
        slug: "draft-news",
        status: "DRAFT",
        deletedAt: null,
        publishedAt: null,
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        kind: "article",
        slug: "published-without-date",
        status: "PUBLISHED",
        deletedAt: null,
        publishedAt: null,
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        kind: "product",
        slug: "deleted-product",
        status: "PUBLISHED",
        deletedAt: "2026-08-05T00:00:00.000Z",
        publishedAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
      },
      {
        kind: "page",
        slug: "terms",
        status: "PUBLISHED",
        deletedAt: null,
        publishedAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
        legalReviewStatus: "PENDING",
        legalReviewedAt: null,
      },
      ...["admin", "api", "preview", "search", "services", "legal"].map((slug) => ({
        kind: "page" as const,
        slug,
        status: "PUBLISHED" as const,
        deletedAt: null,
        publishedAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
        legalReviewStatus: "NOT_REQUIRED" as const,
        legalReviewedAt: null,
      })),
    ];

    expect(buildSitemap(unsafeEntries)).toEqual([]);
  });
});

describe("robots metadata", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.yueshou.example/base/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows public crawling while excluding admin, API, preview, and localized search routes", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/preview",
          "/*/preview",
          "/search",
          "/*/search",
        ],
      },
      sitemap: "https://www.yueshou.example/base/sitemap.xml",
    });
  });
});
