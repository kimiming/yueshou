import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketingShellContentViewModel, PageViewModel } from "@/features/content/view-models";

const { getHomePage, getMarketingShell, getPublishedProducts, pathname, searchParams } = vi.hoisted(() => ({
  getHomePage: vi.fn<(locale: string) => Promise<PageViewModel | null>>(),
  getMarketingShell: vi.fn<(locale: string) => Promise<MarketingShellContentViewModel | null>>(),
  getPublishedProducts: vi.fn(),
  pathname: { value: "/en/about" },
  searchParams: { value: "" },
}));

vi.mock("@/features/content/service", () => ({ getHomePage, getMarketingShell, getPublishedProducts }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })),
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => pathname.value,
  useSearchParams: () => new URLSearchParams(searchParams.value),
}));

import HomePage from "@/app/[locale]/(marketing)/page";
import MarketingLayout from "@/app/[locale]/(marketing)/layout";
import { generateMetadata as generateLocaleMetadata } from "@/app/[locale]/layout";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { localizeHref } from "@/components/marketing/link-utils";
import { MobileNavigation } from "@/components/marketing/mobile-navigation";
import * as FallbackComponents from "@/components/marketing/content-language-fallback";

const shell: MarketingShellContentViewModel = {
  locale: "en",
  translationLocale: "en",
  usedFallback: false,
  summary: "Database-authored company summary.",
  contact: {
    email: "research@example.test",
    phone: "+49 30 123456",
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
    getPublishedProducts.mockReset();
    pathname.value = "/en/about";
    searchParams.value = "";
    window.history.replaceState(null, "", "/en/about");
    getHomePage.mockResolvedValue(homePage);
    getMarketingShell.mockResolvedValue(shell);
    getPublishedProducts.mockResolvedValue([]);
  });

  afterEach(cleanup);

  it("renders a retryable localized marketing error without exposing the underlying exception", () => {
    const MarketingErrorState = Reflect.get(FallbackComponents, "MarketingErrorState");
    expect(MarketingErrorState).toBeTypeOf("function");
    if (typeof MarketingErrorState !== "function") return;
    const retry = vi.fn();

    render(<MarketingErrorState title="Inhalt nicht verfügbar" retryLabel="Erneut versuchen" onRetry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Inhalt nicht verfügbar");
    expect(screen.queryByText(/database|digest|stack/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

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
    expect(screen.getByRole("link", { name: "Email: research@example.test" })).toHaveAttribute("href", "mailto:research@example.test");
    expect(screen.getByRole("link", { name: "Phone: +49 30 123456" })).toHaveAttribute("href", "tel:+4930123456");
    expect(screen.queryByRole("link", { name: "Search" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Request a Quote" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Discuss a project" })).not.toBeInTheDocument();
    expect(screen.getByText("Research use only.")).toBeInTheDocument();
  });

  it("preserves the current pathname, query, and hash when switching languages", async () => {
    pathname.value = "/en/about/team";
    searchParams.value = "q=active&page=2";
    window.history.replaceState(null, "", "/en/about/team?q=active&page=2#quality");
    render(<LanguageSwitcher locale="en" label="Language" />);

    await waitFor(() => expect(screen.getByRole("link", { name: "Deutsch" })).toHaveAttribute(
      "href",
      "/de/about/team?q=active&page=2#quality",
    ));
  });

  it("renders nested CMS navigation in the opened mobile menu", () => {
    render(<MobileNavigation
      label="Mobile navigation"
      menuLabel="Menu"
      closeLabel="Close"
      items={[{ id: "parent", label: "Services", href: "/en/services", enabled: true, sortOrder: 1, children: [{ id: "child", label: "Custom synthesis", href: "/en/services/custom", enabled: true, sortOrder: 1 }] }]}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const navigation = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(within(navigation).getByRole("link", { name: "Custom synthesis" })).toHaveAttribute("href", "/en/services/custom");
    expect(within(navigation).queryByRole("link", { name: "Search" })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: "Request a Quote" })).not.toBeInTheDocument();
  });

  it("closes the mobile menu on Escape and restores focus to its toggle", () => {
    render(<MobileNavigation
      label="Mobile navigation"
      menuLabel="Menu"
      closeLabel="Close"
      items={[{ id: "products", label: "Products", href: "/en/products", enabled: true, sortOrder: 1 }]}
    />);

    const toggle = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(toggle);
    within(screen.getByRole("navigation", { name: "Mobile navigation" })).getByRole("link", { name: "Products" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it("uses configured branding SEO and favicon in the locale metadata", async () => {
    getMarketingShell.mockResolvedValueOnce({
      ...shell,
      defaultSeo: { title: "yueshou peptide synthesis", description: "Precision peptide services", keywords: ["peptide", "synthesis"] },
      favicon: { id: "favicon", storageKey: "public/favicon.svg", filename: "favicon.svg", mimeType: "image/svg+xml", width: null, height: null, locale: "en", translationLocale: "en", usedFallback: false, title: "Favicon", alt: "yueshou favicon" },
    });

    await expect(generateLocaleMetadata({ params: Promise.resolve({ locale: "en" }) })).resolves.toMatchObject({
      title: "yueshou peptide synthesis",
      description: "Precision peptide services",
      keywords: ["peptide", "synthesis"],
      icons: { icon: "/api/media/public/favicon" },
    });
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
    getMarketingShell.mockResolvedValueOnce({ ...shell, locale: "de", socialLinks: [{ label: "LinkedIn", href: "https://linkedin.example.test" }] });
    render(
      await MarketingLayout({
        children: <main><h1>Inhalt</h1></main>,
        params: Promise.resolve({ locale: "de" }),
      }),
    );

    expect(screen.getByRole("button", { name: /Menü/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Sprache" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entdecken" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Soziale Links" })).toBeInTheDocument();
  });

  it.each([
    {
      locale: "de" as const,
      home: "yueshou Startseite",
      menu: "Menü",
      mobileNavigation: "Mobile Navigation",
      scientificWorkflow: "Wissenschaftlicher Arbeitsablauf",
      carouselRole: "Karussell",
      showSlide: "Folie 1 anzeigen: Research highlight one",
    },
    {
      locale: "zh-CN" as const,
      home: "yueshou 首页",
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

    expect(screen.getAllByRole("link", { name: labels.home })).toHaveLength(2);
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

  it("marks English fallback homepage content and explains it in the requested language", async () => {
    getHomePage.mockResolvedValueOnce({
      ...homePage,
      locale: "de",
      translationLocale: "en",
      usedFallback: true,
    });

    render(await HomePage({ params: Promise.resolve({ locale: "de" }) }));

    expect(screen.getByRole("main")).toHaveAttribute("lang", "en");
    expect(screen.getByRole("status")).toHaveTextContent("Die englische Version wird angezeigt");
  });
});
