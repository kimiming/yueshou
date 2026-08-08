import { notFound } from "next/navigation";

import { AboutSection } from "@/components/marketing/sections/about-section";
import { CapabilitiesSection } from "@/components/marketing/sections/capabilities-section";
import { CtaSection } from "@/components/marketing/sections/cta-section";
import { GlobalReachSection } from "@/components/marketing/sections/global-reach-section";
import { HeroSection } from "@/components/marketing/sections/hero-section";
import { NewsSection } from "@/components/marketing/sections/news-section";
import { ProductCategoriesSection } from "@/components/marketing/sections/product-categories-section";
import { QualitySection } from "@/components/marketing/sections/quality-section";
import { ServicesSection } from "@/components/marketing/sections/services-section";
import { StatsSection } from "@/components/marketing/sections/stats-section";
import type { MarketingSectionViewModel } from "@/components/marketing/types";
import { createMarketingHomePageViewModel } from "@/components/marketing/view-models";
import { getHomePage } from "@/features/content/service";
import type { PageViewModel } from "@/features/content/view-models";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

type HomePageDataResult =
  | { status: "ready"; page: PageViewModel | null; dictionary: Dictionary }
  | { status: "error" };

async function loadHomePageData(locale: Locale): Promise<HomePageDataResult> {
  try {
    const [page, dictionary] = await Promise.all([getHomePage(locale), getDictionary(locale)]);
    return { status: "ready", page, dictionary };
  } catch {
    return { status: "error" };
  }
}

function renderSection(
  model: MarketingSectionViewModel,
  locale: Locale,
  slogan: string,
  primaryHeroId: string | undefined,
) {
  switch (model.type) {
    case "hero":
      return <HeroSection key={model.id} model={model} locale={locale} slogan={slogan} primaryHeading={model.id === primaryHeroId} />;
    case "services":
      return <ServicesSection key={model.id} model={model} />;
    case "about":
      return <AboutSection key={model.id} model={model} />;
    case "capabilities":
      return <CapabilitiesSection key={model.id} model={model} />;
    case "quality":
      return <QualitySection key={model.id} model={model} />;
    case "product-categories":
      return <ProductCategoriesSection key={model.id} model={model} />;
    case "global-reach":
      return <GlobalReachSection key={model.id} model={model} />;
    case "stats":
      return <StatsSection key={model.id} model={model} />;
    case "news":
      return <NewsSection key={model.id} model={model} />;
    case "cta":
      return <CtaSection key={model.id} model={model} locale={locale} />;
  }
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale: localeInput } = await params;

  if (!isLocale(localeInput)) {
    notFound();
  }

  const result = await loadHomePageData(localeInput);

  if (result.status === "error") {
    return (
      <main id="main-content" className="server-error-state">
        <div className="marketing-container">
          <h1>粤首</h1>
          <div role="alert">
            <h2>Content is temporarily unavailable</h2>
            <p>Please try again later.</p>
          </div>
        </div>
      </main>
    );
  }

  if (!result.page) {
    notFound();
  }

  const model = createMarketingHomePageViewModel(result.page, result.dictionary);
  const sections = model.sections
    .filter((section) => section.enabled)
    .toSorted((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  const primaryHeroId = sections.find((section) => section.type === "hero")?.id;

  return (
    <main id="main-content">
      {primaryHeroId ? null : <h1 className="visually-hidden">{model.title}</h1>}
      {sections.map((section) => renderSection(section, model.locale, model.slogan, primaryHeroId))}
    </main>
  );
}
