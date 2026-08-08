import { describe, expect, it } from "vitest";

import { createMarketingHomePageViewModel, createMarketingShellViewModel } from "@/components/marketing/view-models";

describe("marketing media view models", () => {
  it("derives same-origin protected public media URLs from CMS media IDs", () => {
    const section = {
      id: "hero", type: "hero" as const, position: 1, enabled: true, sortOrder: 1, config: {}, locale: "en" as const, translationLocale: "en" as const, usedFallback: false, title: "Hero", body: "Body", items: [],
      media: { id: "cm00000000000000000000001", storageKey: "private/never-expose.webp", filename: "hero.webp", mimeType: "image/webp", width: 100, height: 100, alt: "Hero", locale: "en" as const, translationLocale: "en" as const, usedFallback: false, title: "Hero" },
    };
    const home = createMarketingHomePageViewModel({ id: "home", slug: "home", locale: "en", translationLocale: "en", usedFallback: false, title: "Home", body: "", seoTitle: null, seoDescription: null, publishedAt: null, sections: [section] }, { marketing: { hero: { workflow: "", steps: [], choose: "" }, accessibility: { scientificWorkflow: "", carousel: "", carouselRole: "", showSlide: "" }, cards: { explore: "", viewCategory: "", researchUpdate: "", readMore: "" }, errors: { contentUnavailable: "", retry: "" }, navigation: { primary: "", language: "", footer: "" }, footer: { explore: "", contact: "", researchUseOnly: "" }, mobile: { menu: "", close: "" }, }, actions: { requestQuote: "" }, consent: { manage: "" } } as never);
    const shell = createMarketingShellViewModel({ locale: "en", translationLocale: "en", usedFallback: false, summary: "", contact: { addressLines: [] }, navigation: [], logo: section.media }, { marketing: { navigation: { primary: "", language: "", footer: "" }, accessibility: { home: "", mobileNavigation: "" }, footer: { explore: "", contact: "", contactTeam: "", researchUseOnly: "" }, mobile: { menu: "", close: "" } }, actions: { requestQuote: "" }, consent: { manage: "" } } as never);

    expect(home.sections[0].media?.src).toBe("/api/media/public/cm00000000000000000000001");
    expect(shell.logo?.src).toBe("/api/media/public/cm00000000000000000000001");
    expect(JSON.stringify(home)).not.toContain("private/never-expose.webp");
  });
});
