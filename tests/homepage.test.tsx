import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PageViewModel } from "@/features/content/view-models";

const { getHomePage } = vi.hoisted(() => ({
  getHomePage: vi.fn<(locale: string) => Promise<PageViewModel | null>>(),
}));

vi.mock("@/features/content/service", () => ({ getHomePage }));

import HomePage from "@/app/[locale]/(marketing)/page";
import MarketingLayout from "@/app/[locale]/(marketing)/layout";

const homePage: PageViewModel = {
  id: "home-page",
  slug: "home",
  locale: "en",
  translationLocale: "en",
  usedFallback: false,
  title: "Peptide synthesis, precisely delivered",
  body: "A modular scientific research partner.",
  seoTitle: null,
  seoDescription: null,
  publishedAt: "2026-08-08T00:00:00.000Z",
  sections: [
    {
      id: "services",
      type: "services",
      position: 20,
      config: {},
      locale: "en",
      translationLocale: "en",
      usedFallback: false,
      title: "Research services",
      body: "Flexible synthesis pathways for scientific programs.",
    },
    {
      id: "hero",
      type: "hero",
      position: 10,
      config: {
        primaryCta: { label: "Discuss a project", href: "/contact" },
      },
      locale: "en",
      translationLocale: "en",
      usedFallback: false,
      title: "Precision at every sequence",
      body: "Clear workflows from synthesis planning through analytical review.",
    },
    {
      id: "quality",
      type: "quality",
      position: 30,
      config: { enabled: false },
      locale: "en",
      translationLocale: "en",
      usedFallback: false,
      title: "Hidden quality section",
      body: "This disabled module must not render.",
    },
    {
      id: "stats",
      type: "stats",
      position: 40,
      config: {
        items: [
          { label: "Workflow stages", value: "4" },
          { label: "Supported languages", value: "5" },
        ],
      },
      locale: "en",
      translationLocale: "en",
      usedFallback: false,
      title: "Data-led collaboration",
      body: "Only reviewed values are published.",
    },
  ],
};

describe("semantic marketing homepage", () => {
  beforeEach(() => {
    getHomePage.mockReset();
    getHomePage.mockResolvedValue(homePage);
  });

  afterEach(cleanup);

  it("renders one ordered H1 and excludes disabled modules", async () => {
    render(await HomePage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Precision at every sequence",
    );
    expect(screen.getByText("Precision Peptide Synthesis for Global Scientific Research"))
      .toBeInTheDocument();
    expect(screen.queryByText("Hidden quality section")).not.toBeInTheDocument();

    const sections = screen.getByRole("main").querySelectorAll(":scope > section");
    expect([...sections].map((section) => section.getAttribute("data-section"))).toEqual([
      "hero",
      "services",
      "stats",
    ]);
  });

  it("renders the typed semantic shell and locale-aware links", async () => {
    const page = await HomePage({ params: Promise.resolve({ locale: "en" }) });
    render(
      await MarketingLayout({
        children: page,
        params: Promise.resolve({ locale: "en" }),
      }),
    );

    expect(screen.getByRole("banner")).toHaveTextContent("粤首");
    const navigation = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(navigation).getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/en/about",
    );
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deutsch" })).toHaveAttribute("href", "/de");
    expect(screen.getByText("Research use only.")).toBeInTheDocument();
  });

  it("shows an explicit server error state when homepage loading fails", async () => {
    getHomePage.mockRejectedValueOnce(new Error("database unavailable"));

    render(await HomePage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByRole("alert")).toHaveTextContent("Content is temporarily unavailable");
    expect(screen.queryByText("Precision at every sequence")).not.toBeInTheDocument();
  });
});
