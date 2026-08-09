import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArticleViewModel, PageViewModel } from "@/features/content/view-models";

const contentServiceMocks = vi.hoisted(() => ({
  getHomePage: vi.fn<(locale: string) => Promise<PageViewModel | null>>(),
  getPublishedArticle: vi.fn<
    (locale: string, slug: string) => Promise<ArticleViewModel | null>
  >(),
}));

vi.mock("@/features/content/service", () => contentServiceMocks);

import { SeoJsonLd } from "@/components/marketing/seo-json-ld";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import {
  buildMetadata,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "@/features/seo/metadata";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  organizationJsonLd,
  productJsonLd,
  serializeJsonLd,
  serviceJsonLd,
  websiteJsonLd,
} from "@/features/seo/json-ld";
import * as HomePageModule from "@/app/[locale]/(marketing)/page";
import * as NewsArticleModule from "@/app/[locale]/(marketing)/news/[slug]/page";
import * as SearchPageModule from "@/app/[locale]/(marketing)/search/page";

describe("SEO metadata", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.yueshou.example/base-path/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("derives absolute canonical and all language alternates only from the validated site URL", () => {
    const metadata = buildMetadata({
      locale: "de",
      path: "/news/peptide-update",
      title: "Peptid-Update",
      description: "Neue Forschungsnachrichten",
    });

    expect(metadata.alternates).toEqual({
      canonical: "https://www.yueshou.example/base-path/de/news/peptide-update",
      languages: {
        en: "https://www.yueshou.example/base-path/en/news/peptide-update",
        "zh-CN": "https://www.yueshou.example/base-path/zh-CN/news/peptide-update",
        de: "https://www.yueshou.example/base-path/de/news/peptide-update",
        fr: "https://www.yueshou.example/base-path/fr/news/peptide-update",
        es: "https://www.yueshou.example/base-path/es/news/peptide-update",
        "x-default": "https://www.yueshou.example/base-path/en/news/peptide-update",
      },
    });
    expect(metadata.openGraph?.url).toBe(
      "https://www.yueshou.example/base-path/de/news/peptide-update",
    );
  });

  it("keeps the requested canonical while identifying fallback content language", () => {
    const metadata = buildMetadata({
      locale: "de",
      contentLocale: "en",
      path: "/services/custom-synthesis",
      title: "Custom synthesis",
    });

    expect(metadata.alternates?.canonical).toBe("https://www.yueshou.example/base-path/de/services/custom-synthesis");
    expect(metadata.openGraph).toMatchObject({ locale: "en_US" });
  });

  it("publishes the approved YueShou social card for Open Graph and X", () => {
    const metadata = buildMetadata({
      locale: "en",
      path: "/",
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
    });

    expect(metadata.openGraph).toMatchObject({
      siteName: SITE_NAME,
      type: "website",
      images: [
        {
          url: "https://www.yueshou.example/base-path/og.png",
          width: 1730,
          height: 909,
          alt: `${SITE_NAME} — ${SITE_DESCRIPTION}`,
        },
      ],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["https://www.yueshou.example/base-path/og.png"],
    });
  });

  it("marks search results as noindex without reflecting the query in canonical metadata", () => {
    const metadata = buildMetadata({
      locale: "fr",
      path: "/search",
      title: "Recherche",
      noIndex: true,
    });

    expect(metadata.alternates?.canonical).toBe(
      "https://www.yueshou.example/base-path/fr/search",
    );
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("rejects an invalid public site URL instead of accepting a request-controlled fallback", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "javascript:alert(1)");

    expect(() =>
      buildMetadata({ locale: "en", path: "/", title: SITE_NAME }),
    ).toThrow("NEXT_PUBLIC_SITE_URL");
  });
});

describe("structured data", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.yueshou.example/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("uses stable absolute IDs for the Organization and WebSite graphs", () => {
    expect(
      organizationJsonLd({
        summary: "Precision peptide synthesis",
        contact: {
          email: "research@yueshou.example",
          phone: "+86 755 5555 0100",
          addressLines: ["Shenzhen", "China"],
        },
      }),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": "https://www.yueshou.example/#organization",
      name: SITE_NAME,
      alternateName: "YueShou",
      url: "https://www.yueshou.example/",
      logo: "https://www.yueshou.example/og.png",
      description: "Precision peptide synthesis",
      email: "research@yueshou.example",
      telephone: "+86 755 5555 0100",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Shenzhen, China",
      },
    });
    expect(websiteJsonLd()).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": "https://www.yueshou.example/#website",
      url: "https://www.yueshou.example/",
      name: SITE_NAME,
      alternateName: "YueShou",
      description: SITE_DESCRIPTION,
      publisher: { "@id": "https://www.yueshou.example/#organization" },
    });
  });

  it("builds absolute breadcrumb positions without inventing a URL for the current item", () => {
    expect(
      breadcrumbJsonLd([
        { name: "Home", url: "/en" },
        { name: "News", url: "/en/news" },
        { name: "Research update" },
      ]),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://www.yueshou.example/en",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "News",
          item: "https://www.yueshou.example/en/news",
        },
        { "@type": "ListItem", position: 3, name: "Research update" },
      ],
    });
  });

  it("renders a BreadcrumbList beside the accessible breadcrumb navigation", () => {
    const { container } = render(
      createElement(Breadcrumbs, {
        label: "Breadcrumbs",
        items: [
          { label: "Home", href: "/en" },
          { label: "Research update" },
        ],
      }),
    );

    const graph = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}",
    );
    expect(graph).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, name: "Home", item: "https://www.yueshou.example/en" },
        { position: 2, name: "Research update" },
      ],
    });
  });

  it("emits Article publication data and Service/Product graphs for their public routes", () => {
    expect(
      articleJsonLd({
        locale: "en",
        slug: "new-method",
        title: "A new synthesis method",
        excerpt: "A research update",
        publishedAt: "2026-08-01T12:30:00.000Z",
      }),
    ).toMatchObject({
      "@type": "Article",
      "@id": "https://www.yueshou.example/en/news/new-method#article",
      headline: "A new synthesis method",
      datePublished: "2026-08-01T12:30:00.000Z",
      mainEntityOfPage: { "@id": "https://www.yueshou.example/en/news/new-method" },
      publisher: { "@id": "https://www.yueshou.example/#organization" },
    });
    expect(
      serviceJsonLd({ locale: "de", slug: "custom-synthesis", title: "Synthese" }),
    ).toMatchObject({
      "@type": "Service",
      "@id": "https://www.yueshou.example/de/services/custom-synthesis#service",
      url: "https://www.yueshou.example/de/services/custom-synthesis",
      provider: { "@id": "https://www.yueshou.example/#organization" },
    });
    expect(
      productJsonLd({
        locale: "zh-CN",
        slug: "research-peptide",
        title: "Research Peptide",
        category: "Custom peptides",
        casNumber: "123-45-6",
      }),
    ).toMatchObject({
      "@type": "Product",
      "@id": "https://www.yueshou.example/zh-CN/products/research-peptide#product",
      url: "https://www.yueshou.example/zh-CN/products/research-peptide",
      category: "Custom peptides",
      identifier: "123-45-6",
      brand: { "@type": "Brand", name: SITE_NAME },
    });
  });

  it("refuses to emit Article metadata or JSON-LD without a publication date", () => {
    expect(() => buildMetadata({
      locale: "en",
      path: "/news/missing-date",
      title: "Missing date",
      kind: "article",
    } as never)).toThrow("publishedTime");
    expect(() => articleJsonLd({
      locale: "en",
      slug: "missing-date",
      title: "Missing date",
    } as never)).toThrow("publishedAt");
  });

  it("escapes script-breaking user text before rendering JSON-LD", () => {
    const malicious = {
      "@context": "https://schema.org",
      name: "</script><script>window.pwned = true</script>",
    };

    expect(serializeJsonLd(malicious)).toContain(
      "\\u003c/script>\\u003cscript>window.pwned = true\\u003c/script>",
    );
    const { container } = render(createElement(SeoJsonLd, { data: malicious }));
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script?.textContent).toBe(serializeJsonLd(malicious));
    expect(container.querySelectorAll("script")).toHaveLength(1);
  });
});

describe("App Router SEO integration", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.yueshou.example/");
    contentServiceMocks.getHomePage.mockReset();
    contentServiceMocks.getPublishedArticle.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("attaches localized database metadata to the home route", async () => {
    contentServiceMocks.getHomePage.mockResolvedValue({
      id: "home",
      slug: "home",
      locale: "en",
      translationLocale: "en",
      usedFallback: false,
      title: "Research homepage",
      body: "Home body",
      seoTitle: "YueShou Peptide Synthesis",
      seoDescription: "Custom peptide research services",
      publishedAt: "2026-08-01T00:00:00.000Z",
      sections: [],
    });
    const generateMetadata = Reflect.get(HomePageModule, "generateMetadata") as
      | ((props: { params: Promise<{ locale: string }> }) => Promise<unknown>)
      | undefined;

    expect(generateMetadata).toBeTypeOf("function");
    await expect(
      generateMetadata?.({ params: Promise.resolve({ locale: "en" }) }),
    ).resolves.toMatchObject({
      title: "YueShou Peptide Synthesis",
      description: "Custom peptide research services",
      alternates: { canonical: "https://www.yueshou.example/en" },
    });
  });

  it("returns safe home metadata when the CMS lookup is unavailable", async () => {
    contentServiceMocks.getHomePage.mockRejectedValueOnce(new Error("database unavailable"));
    const generateMetadata = Reflect.get(HomePageModule, "generateMetadata") as
      | ((props: { params: Promise<{ locale: string }> }) => Promise<unknown>)
      | undefined;

    await expect(generateMetadata?.({ params: Promise.resolve({ locale: "de" }) })).resolves.toMatchObject({
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      alternates: { canonical: "https://www.yueshou.example/de" },
    });
  });

  it("attaches Article metadata and an escaped Article graph to a published news route", async () => {
    const article: ArticleViewModel = {
      id: "article-1",
      slug: "new-method",
      locale: "en",
      translationLocale: "en",
      usedFallback: false,
      title: "A new synthesis method",
      body: "<p>Research body</p>",
      excerpt: "A research update",
      publishedAt: "2026-08-01T12:30:00.000Z",
      category: {
        slug: "research",
        locale: "en",
        translationLocale: "en",
        usedFallback: false,
        title: "Research",
        body: "Research updates",
      },
      tags: [],
      coverMedia: null,
    };
    contentServiceMocks.getPublishedArticle.mockResolvedValue(article);
    const generateMetadata = Reflect.get(NewsArticleModule, "generateMetadata") as
      | ((props: { params: Promise<{ locale: string; slug: string }> }) => Promise<unknown>)
      | undefined;

    expect(generateMetadata).toBeTypeOf("function");
    await expect(
      generateMetadata?.({
        params: Promise.resolve({ locale: "en", slug: "new-method" }),
      }),
    ).resolves.toMatchObject({
      title: "A new synthesis method",
      openGraph: {
        type: "article",
        publishedTime: "2026-08-01T12:30:00.000Z",
      },
    });

    const { container } = render(
      await NewsArticleModule.default({
        params: Promise.resolve({ locale: "en", slug: "new-method" }),
      }),
    );
    const graph = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}",
    );
    expect(graph).toMatchObject({
      "@type": "Article",
      "@id": "https://www.yueshou.example/en/news/new-method#article",
      datePublished: "2026-08-01T12:30:00.000Z",
    });
  });

  it("attaches noindex metadata to the search route without consuming its query", async () => {
    const generateMetadata = Reflect.get(SearchPageModule, "generateMetadata") as
      | ((props: { params: Promise<{ locale: string }> }) => Promise<unknown>)
      | undefined;

    expect(generateMetadata).toBeTypeOf("function");
    await expect(
      generateMetadata?.({ params: Promise.resolve({ locale: "de" }) }),
    ).resolves.toMatchObject({
      alternates: { canonical: "https://www.yueshou.example/de/search" },
      robots: { index: false, follow: false },
    });
  });
});
