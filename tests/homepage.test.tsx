import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketingShellContentViewModel, PageViewModel } from "@/features/content/view-models";

const { getHomePage, getMarketingShell, pathname } = vi.hoisted(() => ({
  getHomePage: vi.fn<(locale: string) => Promise<PageViewModel | null>>(),
  getMarketingShell: vi.fn<(locale: string) => Promise<MarketingShellContentViewModel | null>>(),
  pathname: { value: "/en/about" },
}));

vi.mock("@/features/content/service", () => ({ getHomePage, getMarketingShell }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => pathname.value,
}));

import HomePage from "@/app/[locale]/(marketing)/page";
import MarketingLayout from "@/app/[locale]/(marketing)/layout";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { localizeHref } from "@/components/marketing/link-utils";

const shell: MarketingShellContentViewModel = {
  locale: "en",
  translationLocale: "en",
  usedFallback: false,
  summary: "Database-authored company summary.",
  contact: {
    email: "research@example.test",
    addressLines: ["Research campus"],
  },
  navigation: [
    { id: "cms-about", label: "CMS About", href: "/about", sortOrder: 10, enabled: true },
    { id: "cms-services", label: "CMS Services", href: "/services", sortOrder: 20, enabled: true },
  ],
};

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
      position: 5,
      sortOrder: 5,
      enabled: true,
      config: {},
      items: [
        {
          id: "service-one",
          locale: "en",
          translationLocale: "en",
          usedFallback: false,
          title: "Service one",
          body: "Service one body",
          href: "/services/one",
        },
      ],
      media: null,
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
      sortOrder: 10,
      enabled: true,
      config: {
        primaryCta: { label: "Discuss a project", href: "/contact" },
      },
      items: [
        {
          id: "highlight-one",
          locale: "en",
          translationLocale: "en",
          usedFallback: false,
          title: "Research highlight one",
          body: "First reviewed highlight",
        },
        {
          id: "highlight-two",
          locale: "en",
          translationLocale: "en",
          usedFallback: false,
          title: "Research highlight two",
          body: "Second reviewed highlight",
        },
      ],
      media: null,
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
      sortOrder: 30,
      enabled: false,
      config: {},
      items: [],
      media: null,
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
      sortOrder: 40,
      enabled: true,
      config: {
        items: [
          { label: "Workflow stages", value: "4" },
          { label: "Supported languages", value: "5" },
        ],
      },
      items: [
        {
          id: "stats-stat-0",
          locale: "en",
          translationLocale: "en",
          usedFallback: false,
          title: "Workflow stages",
          body: "",
          value: "4",
        },
        {
          id: "stats-stat-1",
          locale: "en",
          translationLocale: "en",
          usedFallback: false,
          title: "Supported languages",
          body: "",
          value: "5",
        },
      ],
      media: null,
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
    getMarketingShell.mockReset();
    pathname.value = "/en/about";
    getHomePage.mockResolvedValue(homePage);
    getMarketingShell.mockResolvedValue(shell);
  });

  afterEach(cleanup);

  it("renders one ordered H1 and excludes disabled modules", async () => {
    render(await HomePage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(homePage.title);
    expect(screen.queryByText("Hidden quality section")).not.toBeInTheDocument();

    const sections = screen.getByRole("main").querySelectorAll(":scope > section");
    expect([...sections].map((section) => section.getAttribute("data-section"))).toEqual([
      "services",
      "hero",
      "stats",
    ]);
    const h1 = screen.getByRole("heading", { level: 1 });
    const firstH2 = screen.getAllByRole("heading", { level: 2 })[0];
    expect(h1.compareDocumentPosition(firstH2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute(
      "href",
      "/en/services/one",
    );
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
    expect(screen.getByText("Precision Peptide Synthesis for Global Scientific Research"))
      .toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(navigation).getByRole("link", { name: "CMS About" })).toHaveAttribute(
      "href",
      "/en/about",
    );
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deutsch" })).toHaveAttribute("href", "/de/about");
    expect(screen.getByText("Research use only.")).toBeInTheDocument();
  });

  it("preserves the current localized pathname when switching languages", () => {
    pathname.value = "/en/about/team";
    render(<LanguageSwitcher locale="en" label="Language" />);

    expect(screen.getByRole("link", { name: "Deutsch" })).toHaveAttribute(
      "href",
      "/de/about/team",
    );
  });

  it.each([
    ["/contact", "/de/contact"],
    ["https://example.test/research", "https://example.test/research"],
    ["mailto:research@example.test", "mailto:research@example.test"],
    ["tel:+4930123456", "tel:+4930123456"],
    ["#quality", "#quality"],
  ])("localizes safe relative href %s without changing protocol or fragment links", (href, expected) => {
    expect(localizeHref(href, "de")).toBe(expected);
  });

  it.each([
    ["/en/contact", "de", "/de/contact"],
    ["/zh-CN/contact", "fr", "/fr/contact"],
    ["/de/contact", "es", "/es/contact"],
    ["/fr/contact", "zh-CN", "/zh-CN/contact"],
    ["/es/contact", "en", "/en/contact"],
    ["/en/contact?source=hero#request", "de", "/de/contact?source=hero#request"],
  ] as const)("replaces the supported locale prefix in %s with %s", (href, locale, expected) => {
    expect(localizeHref(href, locale)).toBe(expected);
  });

  it("shows a localized explicit shell error when shell loading fails", async () => {
    getMarketingShell.mockRejectedValueOnce(new Error("database unavailable"));

    render(
      await MarketingLayout({
        children: <main><h1>Child content</h1></main>,
        params: Promise.resolve({ locale: "en" }),
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Site navigation is temporarily unavailable");
    expect(screen.queryByText("Child content")).not.toBeInTheDocument();
  });

  it("passes localized fixed labels into the client controls", async () => {
    getMarketingShell.mockResolvedValueOnce({ ...shell, locale: "de" });
    render(
      await MarketingLayout({
        children: <main><h1>Inhalt</h1></main>,
        params: Promise.resolve({ locale: "de" }),
      }),
    );

    expect(screen.getByRole("button", { name: /Menü/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Sprache" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entdecken" })).toBeInTheDocument();
  });

  it.each([
    {
      locale: "de" as const,
      home: "YueShou Startseite",
      menu: "Menü",
      mobileNavigation: "Mobile Navigation",
      scientificWorkflow: "Wissenschaftlicher Arbeitsablauf",
      carouselRole: "Karussell",
      showSlide: "Folie 1 anzeigen: Research highlight one",
    },
    {
      locale: "zh-CN" as const,
      home: "YueShou 首页",
      menu: "菜单",
      mobileNavigation: "移动导航",
      scientificWorkflow: "科研工作流程",
      carouselRole: "轮播图",
      showSlide: "显示第 1 张幻灯片：Research highlight one",
    },
  ])("localizes $locale accessibility labels, including carousel controls", async (labels) => {
    getHomePage.mockResolvedValueOnce({ ...homePage, locale: labels.locale });
    getMarketingShell.mockResolvedValueOnce({ ...shell, locale: labels.locale });

    const page = await HomePage({ params: Promise.resolve({ locale: labels.locale }) });
    render(
      await MarketingLayout({
        children: page,
        params: Promise.resolve({ locale: labels.locale }),
      }),
    );

    expect(screen.getByRole("link", { name: labels.home })).toBeInTheDocument();
    expect(screen.getByLabelText(labels.scientificWorkflow)).toBeInTheDocument();
    const carousel = screen.getByRole("region", { name: /Forschungshöhepunkte|科研重点/ });
    expect(carousel).toHaveAttribute("aria-roledescription", labels.carouselRole);
    expect(within(carousel).getByRole("button", { name: labels.showSlide })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: labels.menu }));
    expect(screen.getByRole("navigation", { name: labels.mobileNavigation })).toBeInTheDocument();
  });

  it("shows an explicit server error state when homepage loading fails", async () => {
    getHomePage.mockRejectedValueOnce(new Error("database unavailable"));

    render(await HomePage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByRole("alert")).toHaveTextContent("Content is temporarily unavailable");
    expect(screen.queryByText("Precision at every sequence")).not.toBeInTheDocument();
  });
});
