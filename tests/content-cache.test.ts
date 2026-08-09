import { afterEach, describe, expect, it, vi } from "vitest";

import { invalidatePublishedCollection, invalidatePublishedEntity } from "@/features/publishing/cache";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

type CacheRegistration = {
  keyParts: string[];
  tags: string[];
};

describe("public content cache contract", () => {
  afterEach(() => {
    vi.doUnmock("next/cache");
    vi.doUnmock("react");
    vi.doUnmock("@/features/content/repository");
    vi.resetModules();
  });

  it.each([
    ["page" as const, "privacy", "legal"],
    ["service" as const, "custom-synthesis", "services"],
  ])("invalidates the localized %s detail route through its public route prefix", (type, slug, prefix) => {
    const revalidatePath = vi.fn();
    const revalidateTag = vi.fn();

    invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES, { revalidatePath, revalidateTag });

    expect(revalidatePath.mock.calls).toEqual(SUPPORTED_LOCALES.map((locale) => [`/${locale}/${prefix}/${slug}`]));
  });

  it("expires sitemap content whenever a published entity changes", () => {
    const revalidatePath = vi.fn();
    const revalidateTag = vi.fn();

    invalidatePublishedEntity("article", "lab-update", ["en"], { revalidatePath, revalidateTag });

    expect(revalidateTag).toHaveBeenCalledWith("sitemap:content", "max");
  });

  it("invalidates category-dependent collection and detail caches", () => {
    const revalidatePath = vi.fn();
    const revalidateTag = vi.fn();

    invalidatePublishedCollection("product", ["en", "de"], { revalidatePath, revalidateTag });

    expect(revalidatePath.mock.calls).toEqual([["/en/products"], ["/de/products"]]);
    expect(revalidateTag).toHaveBeenCalledWith("product:list", "max");
    expect(revalidateTag).toHaveBeenCalledWith("product-category:list", "max");
    expect(revalidateTag).toHaveBeenCalledWith("page:home", "max");
    expect(revalidateTag).toHaveBeenCalledWith("sitemap:content", "max");
  });

  it("attaches detail, list, home, and sitemap tags to the getters that load Prisma content", async () => {
    const registrations: CacheRegistration[] = [];
    const unstableCache = vi.fn(
      <T extends (...args: never[]) => unknown>(
        load: T,
        keyParts: string[],
        options: { tags: string[] },
      ) => {
        registrations.push({ keyParts, tags: options.tags });
        return load;
      },
    );
    const repository = {
      findPublishedPageBySlug: vi.fn().mockResolvedValue(null),
      findApprovedLegalPageBySlug: vi.fn().mockResolvedValue(null),
      findPublishedArticleBySlug: vi.fn().mockResolvedValue(null),
      findPublishedProductBySlug: vi.fn().mockResolvedValue(null),
      findPublishedServiceBySlug: vi.fn().mockResolvedValue(null),
      findPublishedServices: vi.fn().mockResolvedValue([]),
      findPublishedProducts: vi.fn().mockResolvedValue([]),
      countPublishedProducts: vi.fn().mockResolvedValue(0),
      findPublishedProductCategories: vi.fn().mockResolvedValue([]),
      findLatestPublishedArticles: vi.fn().mockResolvedValue([]),
      findSitemapContent: vi.fn().mockResolvedValue([]),
    };

    vi.doMock("next/cache", () => ({ unstable_cache: unstableCache }));
    vi.doMock("react", async () => ({
      ...(await vi.importActual<typeof import("react")>("react")),
      cache: <T extends (...args: never[]) => unknown>(value: T) => value,
    }));
    vi.doMock("@/features/content/repository", () => ({ contentRepository: repository }));

    const content = await import("@/features/content/service");
    await content.getHomePage("de");
    await content.getPageBySlug("de", "about");
    await content.getApprovedLegalPageBySlug("de", "privacy");
    await content.getPublishedArticle("de", "lab-update");
    await content.getPublishedProduct("de", "bpc-157");
    await content.getPublishedService("de", "custom-synthesis");
    await content.getPublishedServices("de");
    await content.getPublishedProducts("de");
    await content.getProductCatalog("de", { query: "BPC", category: "research", page: 2 });
    await content.getPublishedArticles("de");
    await content.getSitemapContent();

    expect(registrations).toEqual(expect.arrayContaining([
      { keyParts: ["content", "page", "home", "de"], tags: ["page:home", "service:list", "product-category:list", "article:list", "homepage-item:list", "media:global"] },
      { keyParts: ["content", "page", "about", "de"], tags: ["page:about", "page:list"] },
      { keyParts: ["content", "legal", "privacy", "de"], tags: ["page:privacy", "page:list"] },
      { keyParts: ["content", "article", "lab-update", "de"], tags: ["article:lab-update", "article:list", "media:global"] },
      { keyParts: ["content", "product", "bpc-157", "de"], tags: ["product:bpc-157", "product:list", "media:global"] },
      { keyParts: ["content", "service", "custom-synthesis", "de"], tags: ["service:custom-synthesis", "service:list"] },
      { keyParts: ["content", "service-list", "de"], tags: ["service:list"] },
      { keyParts: ["content", "product-list", "de"], tags: ["product:list", "media:global"] },
      { keyParts: ["content", "product-catalog", "de", "bpc", "research", "2"], tags: ["product:list", "product-category:list", "media:global"] },
      { keyParts: ["content", "article-list", "de"], tags: ["article:list", "media:global"] },
      { keyParts: ["content", "sitemap"], tags: ["sitemap:content"] },
    ]));
  });
});
