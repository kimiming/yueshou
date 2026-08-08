import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { createContentService } from "@/features/content/service";

type PageQuery = {
  where: {
    slug: string;
    status: string;
    deletedAt: null;
  };
};

function pageFixture(status: "DRAFT" | "PUBLISHED" = "PUBLISHED") {
  return {
    id: "page-about",
    slug: "about",
    status,
    publishedAt: new Date("2026-08-08T00:00:00.000Z"),
    legalReviewStatus: "NOT_REQUIRED",
    legalReviewedAt: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-08T00:00:00.000Z"),
    deletedAt: null,
    translations: [
      {
        id: "page-en",
        pageId: "page-about",
        locale: "en",
        title: "About us",
        body: "English body",
        seoTitle: "About YueShou",
        seoDescription: "English SEO",
      },
      {
        id: "page-de",
        pageId: "page-about",
        locale: "de",
        title: "Über uns",
        body: "Deutscher Inhalt",
        seoTitle: null,
        seoDescription: null,
      },
    ],
    sections: [
      {
        id: "section-hero",
        pageId: "page-about",
        type: "HERO",
        position: 1,
        isEnabled: true,
        config: { primaryCta: { label: "Contact", href: "/contact" } },
        status: "PUBLISHED",
        publishedAt: new Date("2026-08-08T00:00:00.000Z"),
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-08T00:00:00.000Z"),
        deletedAt: null,
        translations: [
          {
            id: "section-en",
            pageSectionId: "section-hero",
            locale: "en",
            title: "Science at scale",
            body: "English section",
          },
        ],
      },
    ],
  };
}

function pageDatabase(row: ReturnType<typeof pageFixture> | null) {
  const findFirst = vi.fn(async (query: PageQuery) => {
    if (
      row?.slug !== query.where.slug ||
      row.status !== query.where.status ||
      row.deletedAt !== query.where.deletedAt
    ) {
      return null;
    }

    return row;
  });

  return {
    client: {
      page: { findFirst },
    } as unknown as PrismaClient,
    findFirst,
  };
}

describe("content service", () => {
  it("returns the requested translation and serializable page sections", async () => {
    const { client } = pageDatabase(pageFixture());
    const service = createContentService(client);

    const page = await service.getPageBySlug("de", "about");

    expect(page).toEqual({
      id: "page-about",
      slug: "about",
      locale: "de",
      translationLocale: "de",
      usedFallback: false,
      title: "Über uns",
      body: "Deutscher Inhalt",
      seoTitle: null,
      seoDescription: null,
      publishedAt: "2026-08-08T00:00:00.000Z",
      sections: [
        {
          id: "section-hero",
          type: "hero",
          position: 1,
          config: { primaryCta: { label: "Contact", href: "/contact" } },
          locale: "de",
          translationLocale: "en",
          usedFallback: true,
          title: "Science at scale",
          body: "English section",
        },
      ],
    });
    expect(JSON.parse(JSON.stringify(page))).toEqual(page);
  });

  it("falls back to English when the requested page translation is absent", async () => {
    const { client } = pageDatabase(pageFixture());
    const service = createContentService(client);

    const page = await service.getPageBySlug("fr", "about");

    expect(page).toMatchObject({
      locale: "fr",
      translationLocale: "en",
      usedFallback: true,
      title: "About us",
      body: "English body",
    });
  });

  it("never returns a draft page", async () => {
    const { client } = pageDatabase(pageFixture("DRAFT"));
    const service = createContentService(client);

    await expect(service.getPageBySlug("de", "about")).resolves.toBeNull();
  });

  it("maps the URL locale to the database locale explicitly", async () => {
    const fixture = pageFixture();
    fixture.translations.push({
      id: "page-zh",
      pageId: "page-about",
      locale: "zh_CN",
      title: "关于我们",
      body: "中文内容",
      seoTitle: null,
      seoDescription: null,
    });
    const { client } = pageDatabase(fixture);
    const service = createContentService(client);

    const page = await service.getPageBySlug("zh-CN", "about");

    expect(page).toMatchObject({
      locale: "zh-CN",
      translationLocale: "zh-CN",
      usedFallback: false,
      title: "关于我们",
    });
  });

  it.each([
    ["unsupported", "about"],
    ["de", "../draft"],
    ["de", "About"],
  ])("rejects invalid public lookup input (%s, %s)", async (locale, slug) => {
    const { client, findFirst } = pageDatabase(pageFixture());
    const service = createContentService(client);

    await expect(service.getPageBySlug(locale, slug)).rejects.toThrow(
      /Invalid (locale|slug)/,
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns a published article while withholding a non-public cover", async () => {
    const article = {
      id: "article-1",
      slug: "lab-update",
      status: "PUBLISHED",
      deletedAt: null,
      publishedAt: new Date("2026-08-08T02:00:00.000Z"),
      translations: [
        {
          locale: "en",
          title: "Lab update",
          body: "Article body",
          excerpt: "A short update",
        },
      ],
      category: {
        slug: "company-news",
        translations: [{ locale: "en", title: "Company news", body: "News from YueShou" }],
      },
      tags: [{ slug: "laboratory", name: "Laboratory" }],
      coverMedia: {
        id: "media-draft",
        storageKey: "articles/draft.webp",
        filename: "draft.webp",
        mimeType: "image/webp",
        width: 1200,
        height: 630,
        visibility: "PUBLIC",
        status: "DRAFT",
        deletedAt: null,
        translations: [
          { locale: "en", title: "Lab", body: "Lab image", alt: "YueShou laboratory" },
        ],
      },
    };
    const findFirst = vi.fn(async (query: PageQuery) =>
      article.status === query.where.status && article.deletedAt === query.where.deletedAt
        ? article
        : null,
    );
    const client = { article: { findFirst } } as unknown as PrismaClient;

    const result = await createContentService(client).getPublishedArticle("de", "lab-update");

    expect(result).toMatchObject({
      id: "article-1",
      locale: "de",
      translationLocale: "en",
      usedFallback: true,
      excerpt: "A short update",
      publishedAt: "2026-08-08T02:00:00.000Z",
      category: { slug: "company-news", title: "Company news" },
      tags: [{ slug: "laboratory", name: "Laboratory" }],
      coverMedia: null,
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("returns published product details with only repository-approved media", async () => {
    const product = {
      id: "product-1",
      slug: "bpc-157",
      status: "PUBLISHED",
      deletedAt: null,
      casNumber: "137525-51-0",
      sequence: "GEPPPGKPADDAGLV",
      specifications: { purity: ">=98%" },
      publishedAt: new Date("2026-08-08T03:00:00.000Z"),
      translations: [{ locale: "en", title: "BPC-157", body: "Research use only" }],
      category: {
        slug: "research-peptides",
        translations: [
          { locale: "en", title: "Research peptides", body: "Peptides for research" },
        ],
      },
      media: [
        {
          id: "media-1",
          storageKey: "products/bpc-157.webp",
          filename: "bpc-157.webp",
          mimeType: "image/webp",
          width: 800,
          height: 800,
          visibility: "PUBLIC",
          status: "PUBLISHED",
          deletedAt: null,
          translations: [
            { locale: "en", title: "BPC-157", body: "Product vial", alt: "BPC-157 vial" },
          ],
        },
      ],
    };
    const findFirst = vi.fn(async (query: PageQuery) =>
      product.status === query.where.status && product.deletedAt === query.where.deletedAt
        ? product
        : null,
    );
    const client = { product: { findFirst } } as unknown as PrismaClient;

    const result = await createContentService(client).getPublishedProduct("fr", "bpc-157");

    expect(result).toMatchObject({
      id: "product-1",
      locale: "fr",
      usedFallback: true,
      casNumber: "137525-51-0",
      specifications: { purity: ">=98%" },
      category: { slug: "research-peptides", title: "Research peptides" },
      media: [
        {
          id: "media-1",
          storageKey: "products/bpc-157.webp",
          alt: "BPC-157 vial",
          translationLocale: "en",
        },
      ],
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
