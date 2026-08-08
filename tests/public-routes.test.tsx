import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RichContent } from "@/components/marketing/rich-content";
import type { ArticleViewModel, PageViewModel, ProductViewModel } from "@/features/content/view-models";

const contentMocks = vi.hoisted(() => ({
  getApprovedLegalPageBySlug: vi.fn(),
  getPageBySlug: vi.fn(),
  getPublishedArticle: vi.fn(),
  getPublishedProduct: vi.fn(),
  getPublishedService: vi.fn(),
}));

vi.mock("@/features/content/service", () => contentMocks);
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

afterEach(cleanup);

const page = (slug: string): PageViewModel => ({
  id: `page-${slug}`,
  slug,
  locale: "en",
  translationLocale: "en",
  usedFallback: false,
  title: `Title for ${slug}`,
  body: `<p>Body for ${slug}</p>`,
  seoTitle: null,
  seoDescription: null,
  publishedAt: "2026-08-08T00:00:00.000Z",
  sections: [],
});

const product: ProductViewModel = {
  id: "product-1",
  slug: "published-product",
  locale: "en",
  translationLocale: "en",
  usedFallback: false,
  title: "Published product",
  body: "<p>Product body</p>",
  casNumber: "123-45-6",
  sequence: "PEPTIDE",
  specifications: null,
  publishedAt: "2026-08-08T00:00:00.000Z",
  category: {
    slug: "research",
    locale: "en",
    translationLocale: "en",
    usedFallback: false,
    title: "Research",
    body: "Research products",
  },
  media: [],
};

const article: ArticleViewModel = {
  id: "article-1",
  slug: "published-article",
  locale: "en",
  translationLocale: "en",
  usedFallback: false,
  title: "Published article",
  body: "<p>Article body</p>",
  excerpt: "Article excerpt",
  publishedAt: "2026-08-08T00:00:00.000Z",
  category: product.category,
  tags: [],
  coverMedia: null,
};

describe("public content routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["terms", "privacy", "ruo-policy", "shipping-compliance", "cookie-policy"])(
    "renders %s as its own legal article with exactly one heading level one",
    async (slug) => {
      contentMocks.getApprovedLegalPageBySlug.mockResolvedValue(page(slug));
      const { default: LegalPage } = await import(
        "@/app/[locale]/(marketing)/legal/[slug]/page"
      );

      const view = await LegalPage({ params: Promise.resolve({ locale: "en", slug }) });
      const { container } = render(view);

      expect(screen.getByRole("article")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(`Title for ${slug}`);
      expect(container.querySelectorAll("h1")).toHaveLength(1);
      expect(contentMocks.getApprovedLegalPageBySlug).toHaveBeenCalledWith("en", slug);
    },
  );

  it("rejects an unknown legal slug before querying content", async () => {
    const { default: LegalPage } = await import(
      "@/app/[locale]/(marketing)/legal/[slug]/page"
    );

    await expect(
      LegalPage({ params: Promise.resolve({ locale: "en", slug: "invented-policy" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(contentMocks.getApprovedLegalPageBySlug).not.toHaveBeenCalled();
  });

  it("rejects a published legal page that is not approved", async () => {
    contentMocks.getApprovedLegalPageBySlug.mockResolvedValue(null);
    const { default: LegalPage } = await import(
      "@/app/[locale]/(marketing)/legal/[slug]/page"
    );

    await expect(
      LegalPage({ params: Promise.resolve({ locale: "en", slug: "privacy" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders a published product detail and rejects an unavailable draft", async () => {
    const { default: ProductPage } = await import(
      "@/app/[locale]/(marketing)/products/[slug]/page"
    );
    contentMocks.getPublishedProduct.mockResolvedValueOnce(product).mockResolvedValueOnce(null);

    const view = await ProductPage({
      params: Promise.resolve({ locale: "en", slug: "published-product" }),
    });
    const { container } = render(view);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Published product");
    expect(container.querySelectorAll("h1")).toHaveLength(1);

    await expect(
      ProductPage({ params: Promise.resolve({ locale: "en", slug: "draft-product" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders a published article detail and rejects an unavailable draft", async () => {
    const { default: NewsArticlePage } = await import(
      "@/app/[locale]/(marketing)/news/[slug]/page"
    );
    contentMocks.getPublishedArticle.mockResolvedValueOnce(article).mockResolvedValueOnce(null);

    const view = await NewsArticlePage({
      params: Promise.resolve({ locale: "en", slug: "published-article" }),
    });
    const { container } = render(view);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Published article");
    expect(container.querySelectorAll("h1")).toHaveLength(1);

    await expect(
      NewsArticlePage({ params: Promise.resolve({ locale: "en", slug: "draft-article" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders a non-reserved published CMS page through the generic route", async () => {
    contentMocks.getPageBySlug.mockResolvedValue(page("quality"));
    const { default: GenericContentPage } = await import(
      "@/app/[locale]/(marketing)/[slug]/page"
    );

    const view = await GenericContentPage({
      params: Promise.resolve({ locale: "en", slug: "quality" }),
    });
    const { container } = render(view);

    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Title for quality");
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(contentMocks.getPageBySlug).toHaveBeenCalledWith("en", "quality");
  });

  it("rejects an invalid detail slug without querying the service", async () => {
    const { default: ProductPage } = await import(
      "@/app/[locale]/(marketing)/products/[slug]/page"
    );

    await expect(
      ProductPage({ params: Promise.resolve({ locale: "en", slug: "../draft" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(contentMocks.getPublishedProduct).not.toHaveBeenCalled();
  });

  it("does not turn an unexpected product lookup failure into not-found", async () => {
    const failure = new Error("database unavailable");
    contentMocks.getPublishedProduct.mockRejectedValue(failure);
    const { default: ProductPage } = await import(
      "@/app/[locale]/(marketing)/products/[slug]/page"
    );

    await expect(
      ProductPage({ params: Promise.resolve({ locale: "en", slug: "published-product" }) }),
    ).rejects.toBe(failure);
  });

  it("does not turn an unexpected article lookup failure into not-found", async () => {
    const failure = new Error("translation mapping failed");
    contentMocks.getPublishedArticle.mockRejectedValue(failure);
    const { default: NewsArticlePage } = await import(
      "@/app/[locale]/(marketing)/news/[slug]/page"
    );

    await expect(
      NewsArticlePage({ params: Promise.resolve({ locale: "en", slug: "published-article" }) }),
    ).rejects.toBe(failure);
  });

  it("does not turn an unexpected service lookup failure into not-found", async () => {
    const failure = new Error("service database unavailable");
    contentMocks.getPublishedService.mockRejectedValue(failure);
    const { default: ServicePage } = await import(
      "@/app/[locale]/(marketing)/services/[slug]/page"
    );

    await expect(
      ServicePage({ params: Promise.resolve({ locale: "en", slug: "peptide-synthesis" }) }),
    ).rejects.toBe(failure);
  });

  it("does not turn an unexpected generic page failure into not-found", async () => {
    const failure = new Error("page database unavailable");
    contentMocks.getPageBySlug.mockRejectedValue(failure);
    const { default: GenericContentPage } = await import(
      "@/app/[locale]/(marketing)/[slug]/page"
    );

    await expect(
      GenericContentPage({ params: Promise.resolve({ locale: "en", slug: "quality" }) }),
    ).rejects.toBe(failure);
  });
});

describe("RichContent", () => {
  it("preserves semantic content while removing executable markup and unsafe URLs", () => {
    const html = `
      <h2>Accessible section</h2>
      <ul><li>One</li></ul>
      <table><thead><tr><th scope="col">Name</th></tr></thead><tbody><tr><td>Value</td></tr></tbody></table>
      <a href="https://example.test" target="_blank">External</a>
      <a href="javascript:alert(1)" onclick="alert(1)">Unsafe</a>
      <script>alert(1)</script><style>body{display:none}</style><iframe src="https://example.test"></iframe>
    `;

    const { container } = render(<RichContent html={html} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Accessible section");
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "External" })).toHaveAttribute(
      "rel",
      expect.stringMatching(/noopener/),
    );
    expect(screen.getByText("Unsafe")).not.toHaveAttribute("href");
    expect(container.querySelector("script, style, iframe")).toBeNull();
    expect(container.innerHTML).not.toContain("onclick");
    expect(container.innerHTML).not.toContain("javascript:");
  });
});
