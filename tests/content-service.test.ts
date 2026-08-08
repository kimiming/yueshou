import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  createContentRepository,
  type ContentRepository,
} from "@/features/content/repository";
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
    legalReviewedAt: null as Date | null,
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

function pageRepository(row: ReturnType<typeof pageFixture> | null) {
  const findPublishedPageBySlug = vi.fn(async (slug: string) =>
    row?.slug === slug ? row : null,
  );

  return {
    repository: { findPublishedPageBySlug } as unknown as ContentRepository,
    findPublishedPageBySlug,
  };
}

describe("content service", () => {
  it("returns the requested translation and serializable page sections", async () => {
    const { repository } = pageRepository(pageFixture());
    const service = createContentService(repository);

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
          sortOrder: 1,
          enabled: true,
          config: { primaryCta: { label: "Contact", href: "/contact" } },
          items: [],
          media: null,
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

  it("maps persisted multi-word homepage section types to public slugs", async () => {
    const fixture = pageFixture();
    const section = fixture.sections[0];
    fixture.sections = [
      { ...section, id: "section-products", type: "PRODUCT_CATEGORIES", position: 1 },
      { ...section, id: "section-global", type: "GLOBAL_REACH", position: 2 },
    ];
    const { repository } = pageRepository(fixture);

    const page = await createContentService(repository).getPageBySlug("en", "about");

    expect(page?.sections.map(({ type }) => type)).toEqual([
      "product-categories",
      "global-reach",
    ]);
  });

  it("falls back to English when the requested page translation is absent", async () => {
    const { repository } = pageRepository(pageFixture());
    const service = createContentService(repository);

    const page = await service.getPageBySlug("fr", "about");

    expect(page).toMatchObject({
      locale: "fr",
      translationLocale: "en",
      usedFallback: true,
      title: "About us",
      body: "English body",
    });
  });

  it("repository never returns a draft page", async () => {
    const { client } = pageDatabase(pageFixture("DRAFT"));
    const repository = createContentRepository(client);

    await expect(repository.findPublishedPageBySlug("about")).resolves.toBeNull();
  });

  it("legal repository rejects a published NOT_REQUIRED page", async () => {
    const fixture = pageFixture();
    fixture.slug = "privacy";
    const findFirst = vi.fn(async (query: {
      where: {
        slug: string;
        status: string;
        deletedAt: null;
        legalReviewStatus: string;
        legalReviewedAt: { not: null };
      };
    }) => {
      if (
        fixture.slug !== query.where.slug ||
        fixture.status !== query.where.status ||
        fixture.legalReviewStatus !== query.where.legalReviewStatus ||
        fixture.legalReviewedAt === null
      ) return null;
      return fixture;
    });
    const repository = createContentRepository({ page: { findFirst } } as unknown as PrismaClient);

    await expect(repository.findApprovedLegalPageBySlug("privacy")).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        slug: "privacy",
        status: "PUBLISHED",
        deletedAt: null,
        legalReviewStatus: "APPROVED",
        legalReviewedAt: { not: null },
      },
    }));
  });

  it("returns an approved published legal page with a review timestamp", async () => {
    const fixture = pageFixture();
    fixture.slug = "privacy";
    fixture.legalReviewStatus = "APPROVED";
    fixture.legalReviewedAt = new Date("2026-08-08T04:00:00.000Z");
    const repository = {
      findApprovedLegalPageBySlug: vi.fn(async () => fixture),
    } as unknown as ContentRepository;

    const result = await createContentService(repository).getApprovedLegalPageBySlug("en", "privacy");

    expect(result).toMatchObject({ slug: "privacy", title: "About us" });
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
    const { repository } = pageRepository(fixture);
    const service = createContentService(repository);

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
    const { repository, findPublishedPageBySlug } = pageRepository(pageFixture());
    const service = createContentService(repository);

    await expect(service.getPageBySlug(locale, slug)).rejects.toThrow(
      /Invalid (locale|slug)/,
    );
    expect(findPublishedPageBySlug).not.toHaveBeenCalled();
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
    const repository = {
      findPublishedArticleBySlug: vi.fn(async (slug: string) =>
        slug === article.slug ? article : null,
      ),
    } as unknown as ContentRepository;

    const result = await createContentService(repository).getPublishedArticle("de", "lab-update");

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

  it("requires a publication timestamp in the public article repository filter", async () => {
    const findFirst = vi.fn(async () => null);
    const database = {
      article: { findFirst },
    } as unknown as PrismaClient;

    await createContentRepository(database).findPublishedArticleBySlug("lab-update");

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        slug: "lab-update",
        status: "PUBLISHED",
        deletedAt: null,
        publishedAt: { not: null },
      }),
    }));
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
    const repository = {
      findPublishedProductBySlug: vi.fn(async (slug: string) =>
        slug === product.slug ? product : null,
      ),
    } as unknown as ContentRepository;

    const result = await createContentService(repository).getPublishedProduct("fr", "bpc-157");

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
