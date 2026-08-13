import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HomeProductShowcase } from "@/components/marketing/home-product-showcase";
import { toShowcaseProducts } from "@/features/content/showcase-products";
import type { ProductViewModel } from "@/features/content/view-models";

const products = Array.from({ length: 25 }, (_, index) => ({
  slug: `zpc-wrinklend-${String(index + 1).padStart(3, "0")}s`,
  title: `Product ${index + 1}`,
  image: { src: `/product-${index + 1}.jpg`, alt: `Product ${index + 1}` },
}));

afterEach(cleanup);

describe("HomeProductShowcase", () => {
  it("limits the homepage to two pages and links More to the complete Products view", () => {
    render(<HomeProductShowcase locale="en" products={products} maxPages={2} moreHref="/en/products" />);

    expect(screen.getAllByRole("link").filter((link) => link.classList.contains("home-product-card"))).toHaveLength(10);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "More →" })).toHaveAttribute("href", "/en/products");

    fireEvent.click(screen.getByRole("button", { name: "Product page 2" }));
    expect(screen.getByRole("link", { name: /Product 20/ })).toHaveAttribute("href", "/en/products/zpc-wrinklend-020s");
    expect(screen.queryByRole("link", { name: /Product 21/ })).not.toBeInTheDocument();
  });

  it("shows every page when used by the Products route", () => {
    render(<HomeProductShowcase locale="en" products={products} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByRole("link", { name: "More →" })).not.toBeInTheDocument();
  });

  it("keeps every published product slug when mapping showcase cards", () => {
    const productRecords = [
      productRecord("god-use", "god use", "media-god"),
      productRecord("yueshou", "YueShou", "media-yueshou"),
      productRecord("zpc-wrinklend-001s", "ZPC Wrinklend"),
    ];

    expect(toShowcaseProducts(productRecords)).toEqual([
      { slug: "god-use", title: "god use", image: { src: "/api/media/public/media-god", alt: "god use image" } },
      { slug: "yueshou", title: "YueShou", image: { src: "/api/media/public/media-yueshou", alt: "YueShou image" } },
      { slug: "zpc-wrinklend-001s", title: "ZPC Wrinklend", image: { src: "/og.png", alt: "ZPC Wrinklend" } },
    ]);
  });

  it("limits homepage showcase cards to the newest published products supplied by the service", () => {
    const mapped = toShowcaseProducts(
      Array.from({ length: 25 }, (_, index) => productRecord(`product-${index + 1}`, `Product ${index + 1}`)),
      20,
    );

    expect(mapped).toHaveLength(20);
    expect(mapped.at(0)?.slug).toBe("product-1");
    expect(mapped.at(-1)?.slug).toBe("product-20");
  });
});

function productRecord(slug: string, title: string, mediaId?: string): ProductViewModel {
  return {
    id: slug,
    slug,
    locale: "en",
    translationLocale: "en",
    usedFallback: false,
    title,
    body: "Research product",
    casNumber: null,
    sequence: null,
    specifications: mediaId ? { coverMediaId: mediaId } : null,
    publishedAt: "2026-08-13T00:00:00.000Z",
    category: {
      slug: "featured-peptides",
      locale: "en",
      translationLocale: "en",
      usedFallback: false,
      title: "Featured peptides",
      body: "Featured products",
    },
    media: mediaId
      ? [{
          id: mediaId,
          storageKey: `${mediaId}.png`,
          filename: `${mediaId}.png`,
          mimeType: "image/png",
          width: 800,
          height: 800,
          locale: "en",
          translationLocale: "en",
          usedFallback: false,
          title: `${title} image`,
          alt: `${title} image`,
        }]
      : [],
  };
}
