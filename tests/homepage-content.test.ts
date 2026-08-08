import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";
import {
  createContentRepository,
  type ContentRepository,
  type PublishedPageRecord,
} from "@/features/content/repository";
import { createContentService } from "@/features/content/service";

const ids = {
  heroMedia: "cm00000000000000000000001",
  aboutMedia: "cm00000000000000000000002",
  qualityMedia: "cm00000000000000000000003",
  serviceOne: "cm00000000000000000000011",
  serviceTwo: "cm00000000000000000000012",
  itemOne: "cm00000000000000000000021",
  itemTwo: "cm00000000000000000000022",
  hiddenItem: "cm00000000000000000000023",
  categoryOne: "cm00000000000000000000031",
  categoryTwo: "cm00000000000000000000032",
  hiddenCategory: "cm00000000000000000000033",
} as const;

const translation = (title: string, body = `${title} body`) => [
  { locale: "en" as const, title, body },
];

function section(
  id: string,
  type: PublishedPageRecord["sections"][number]["type"],
  position: number,
  config: unknown,
): PublishedPageRecord["sections"][number] {
  return { id, type, position, config, translations: translation(`${type} title`) };
}

function homeRecord(): PublishedPageRecord {
  return {
    id: "home",
    slug: "home",
    publishedAt: new Date("2026-08-08T00:00:00.000Z"),
    translations: [
      {
        locale: "en",
        title: "Research homepage",
        body: "Research homepage body",
        seoTitle: null,
        seoDescription: null,
      },
    ],
    sections: [
      section("hero", "HERO", 1, {
        imageId: ids.heroMedia,
        primaryCta: { label: "Contact", href: "/contact" },
      }),
      section("services", "SERVICES", 2, {
        serviceIds: [ids.serviceTwo, ids.serviceOne],
      }),
      section("about", "ABOUT", 3, { imageId: ids.aboutMedia }),
      section("capabilities", "CAPABILITIES", 4, {
        itemIds: [ids.itemTwo, ids.hiddenItem, ids.itemOne],
      }),
      section("quality", "QUALITY", 5, {
        imageId: ids.qualityMedia,
        itemIds: [ids.itemOne],
      }),
      section("categories", "PRODUCT_CATEGORIES", 6, {
        categoryIds: [ids.categoryTwo, ids.hiddenCategory, ids.categoryOne],
      }),
      section("global", "GLOBAL_REACH", 7, {
        itemIds: [ids.itemTwo, ids.itemOne],
      }),
      section("stats", "STATS", 8, {
        items: [{ label: "Languages", value: "5" }],
      }),
      section("news", "NEWS", 9, { count: 2 }),
      section("cta", "CTA", 10, {
        primaryCta: { label: "Start", href: "/contact" },
      }),
    ],
  };
}

function media(id: string, title: string) {
  return {
    id,
    storageKey: `public/${id}.webp`,
    filename: `${id}.webp`,
    mimeType: "image/webp",
    width: 1600,
    height: 900,
    visibility: "PUBLIC" as const,
    status: "PUBLISHED" as const,
    deletedAt: null,
    translations: [{ ...translation(title)[0], alt: `${title} alt` }],
  };
}

function article(id: string, slug: string, title: string) {
  return {
    id,
    slug,
    publishedAt: new Date("2026-08-08T00:00:00.000Z"),
    translations: [{ ...translation(title)[0], excerpt: `${title} excerpt` }],
    category: { slug: "updates", translations: translation("Updates") },
    tags: [],
    coverMedia: null,
  };
}

describe("homepage content hydration", () => {
  it("repository filters every referenced record to published public content", async () => {
    const mediaFindMany = vi.fn(async () => []);
    const serviceFindMany = vi.fn(async () => []);
    const settingFindMany = vi.fn(async () => []);
    const categoryFindMany = vi.fn(async () => []);
    const articleFindMany = vi.fn(async () => []);
    const navigationFindMany = vi.fn(async () => []);
    const settingFindFirst = vi.fn(async () => null);
    const repository = createContentRepository({
      mediaAsset: { findMany: mediaFindMany },
      service: { findMany: serviceFindMany },
      siteSetting: { findMany: settingFindMany, findFirst: settingFindFirst },
      productCategory: { findMany: categoryFindMany },
      article: { findMany: articleFindMany },
      navigationItem: { findMany: navigationFindMany },
    } as unknown as PrismaClient) as ContentRepository & {
      findPublishedMediaByIds(ids: string[]): Promise<unknown>;
      findPublishedServicesByIds(ids: string[]): Promise<unknown>;
      findPublishedHomepageItemsByIds(ids: string[]): Promise<unknown>;
      findPublishedProductCategoriesByIds(ids: string[]): Promise<unknown>;
      findLatestPublishedArticles(count: number): Promise<unknown>;
      findPublishedSiteSettingByKey(key: string): Promise<unknown>;
      findPublishedNavigationItems(): Promise<unknown>;
    };

    await repository.findPublishedMediaByIds([ids.heroMedia]);
    await repository.findPublishedServicesByIds([ids.serviceOne]);
    await repository.findPublishedHomepageItemsByIds([ids.itemOne]);
    await repository.findPublishedProductCategoriesByIds([ids.categoryOne]);
    await repository.findLatestPublishedArticles(3);
    await repository.findPublishedSiteSettingByKey("brand");
    await repository.findPublishedNavigationItems();

    expect(mediaFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "PUBLISHED",
        visibility: "PUBLIC",
        deletedAt: null,
      }),
    }));
    for (const query of [serviceFindMany, settingFindMany, categoryFindMany]) {
      expect(query).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: "PUBLISHED", deletedAt: null }),
      }));
    }
    expect(articleFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "PUBLISHED",
        deletedAt: null,
        category: { is: { status: "PUBLISHED", deletedAt: null } },
      }),
      take: 3,
    }));
    expect(settingFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "brand", status: "PUBLISHED", deletedAt: null },
    }));
    expect(navigationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        parentId: null,
        isVisible: true,
        status: "PUBLISHED",
        deletedAt: null,
      },
    }));
  });

  it("hydrates all ten validated module contracts in configured order", async () => {
    const repository = {
      findPublishedPageBySlug: vi.fn(async () => homeRecord()),
      findPublishedMediaByIds: vi.fn(async () => [
        media(ids.aboutMedia, "About media"),
        media(ids.heroMedia, "Hero media"),
      ]),
      findPublishedServicesByIds: vi.fn(async () => [
        { id: ids.serviceOne, slug: "one", translations: translation("Service one") },
        { id: ids.serviceTwo, slug: "two", translations: translation("Service two") },
      ]),
      findPublishedHomepageItemsByIds: vi.fn(async () => [
        { id: ids.itemOne, key: "item-one", value: null, translations: translation("Item one") },
        { id: ids.itemTwo, key: "item-two", value: { href: "/quality" }, translations: translation("Item two") },
      ]),
      findPublishedProductCategoriesByIds: vi.fn(async () => [
        { id: ids.categoryOne, slug: "one", translations: translation("Category one") },
        { id: ids.categoryTwo, slug: "two", translations: translation("Category two") },
      ]),
      findLatestPublishedArticles: vi.fn(async () => [
        article("article-2", "second", "Second article"),
        article("article-1", "first", "First article"),
      ]),
    } as unknown as ContentRepository;

    const home = await createContentService(repository).getHomePage("en");

    expect(home?.sections).toMatchObject([
      { type: "hero", media: { id: ids.heroMedia }, items: [] },
      {
        type: "services",
        items: [
          { id: ids.serviceTwo, title: "Service two", href: "/services/two" },
          { id: ids.serviceOne, title: "Service one", href: "/services/one" },
        ],
      },
      { type: "about", media: { id: ids.aboutMedia }, items: [] },
      {
        type: "capabilities",
        items: [
          { id: ids.itemTwo, title: "Item two", href: "/quality" },
          { id: ids.itemOne, title: "Item one" },
        ],
      },
      { type: "quality", media: null, items: [{ id: ids.itemOne }] },
      {
        type: "product-categories",
        items: [
          { id: ids.categoryTwo, title: "Category two", href: "/products?category=two" },
          { id: ids.categoryOne, title: "Category one", href: "/products?category=one" },
        ],
      },
      {
        type: "global-reach",
        items: [{ id: ids.itemTwo }, { id: ids.itemOne }],
      },
      { type: "stats", items: [{ title: "Languages", value: "5" }] },
      {
        type: "news",
        items: [
          { id: "article-2", title: "Second article", href: "/news/second" },
          { id: "article-1", title: "First article", href: "/news/first" },
        ],
      },
      { type: "cta", media: null, items: [] },
    ]);
    expect(repository.findPublishedMediaByIds).toHaveBeenCalledWith([
      ids.heroMedia,
      ids.aboutMedia,
      ids.qualityMedia,
    ]);
    expect(repository.findLatestPublishedArticles).toHaveBeenCalledWith(2);
  });

  it("loads translated published shell data without fabricating navigation or contact", async () => {
    const repository = {
      findPublishedSiteSettingByKey: vi.fn(async () => ({
        id: "brand-setting",
        key: "brand",
        value: {
          email: "research@example.test",
          phone: "+49 30 123456",
          addressLines: ["Research campus"],
        },
        translations: [
          { locale: "en", title: "YueShou", body: "English company summary" },
          { locale: "de", title: "YueShou", body: "Deutsche Unternehmensbeschreibung" },
        ],
      })),
      findPublishedNavigationItems: vi.fn(async () => [
        { id: "nav-two", href: "/services", position: 20, translations: translation("Services") },
        {
          id: "nav-one",
          href: "/about",
          position: 10,
          translations: [
            { locale: "en", title: "About", body: "About" },
            { locale: "de", title: "Über uns", body: "Über uns" },
          ],
        },
      ]),
    } as unknown as ContentRepository;
    const service = createContentService(repository) as ReturnType<typeof createContentService> & {
      getMarketingShell(locale: string): Promise<unknown>;
    };

    const shell = await service.getMarketingShell("de");

    expect(shell).toMatchObject({
      locale: "de",
      summary: "Deutsche Unternehmensbeschreibung",
      contact: {
        email: "research@example.test",
        phone: "+49 30 123456",
        addressLines: ["Research campus"],
      },
      navigation: [
        { id: "nav-one", label: "Über uns", href: "/about", sortOrder: 10 },
        { id: "nav-two", label: "Services", href: "/services", sortOrder: 20 },
      ],
    });
  });
});
