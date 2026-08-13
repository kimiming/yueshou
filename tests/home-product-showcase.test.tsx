import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HomeProductShowcase } from "@/components/marketing/home-product-showcase";

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
});
