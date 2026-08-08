import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PageViewModel } from "@/features/content/view-models";

const { getHomePage } = vi.hoisted(() => ({
  getHomePage: vi.fn<(locale: string) => Promise<PageViewModel | null>>(),
}));

vi.mock("@/features/content/service", () => ({ getHomePage }));

import Home from "@/app/[locale]/(marketing)/page";
import { metadata } from "@/app/[locale]/layout";

describe("YueShou branding", () => {
  afterEach(cleanup);

  it("uses the required Chinese brand name in root metadata", () => {
    expect(metadata.title).toBe("粤首");
  });

  it("does not render starter platform trademarks on the public home page", async () => {
    getHomePage.mockResolvedValueOnce({
      id: "home",
      slug: "home",
      locale: "en",
      translationLocale: "en",
      usedFallback: false,
      title: "Research homepage",
      body: "Research content",
      seoTitle: null,
      seoDescription: null,
      publishedAt: null,
      sections: [],
    });
    render(await Home({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.queryByAltText(/Next\.js logo/i)).not.toBeInTheDocument();
    expect(screen.queryByAltText(/Vercel logomark/i)).not.toBeInTheDocument();
  });
});
