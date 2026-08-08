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
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

type HomePageDataResult =
  | { status: "ready"; page: PageViewModel | null }
  | { status: "error" };

async function loadHomePageData(locale: Locale): Promise<HomePageDataResult> {
  try {
    return { status: "ready", page: await getHomePage(locale) };
  } catch {
    return { status: "error" };
  }
}

function renderSection(
  model: MarketingSectionViewModel,
  locale: Locale,
  labels: ReturnType<typeof createMarketingHomePageViewModel>["labels"],
) {
  switch (model.type) {
    case "hero":
      return <HeroSection key={model.id} model={model} locale={locale} labels={labels} />;
    case "services":
      return <ServicesSection key={model.id} model={model} exploreLabel={labels.explore} />;
    case "about":
      return <AboutSection key={model.id} model={model} />;
    case "capabilities":
      return <CapabilitiesSection key={model.id} model={model} />;
    case "quality":
      return <QualitySection key={model.id} model={model} />;
    case "product-categories":
      return <ProductCategoriesSection key={model.id} model={model} linkLabel={labels.viewCategory} />;
    case "global-reach":
      return <GlobalReachSection key={model.id} model={model} />;
    case "stats":
      return <StatsSection key={model.id} model={model} />;
    case "news":
      return <NewsSection key={model.id} model={model} updateLabel={labels.researchUpdate} readMoreLabel={labels.readMore} />;
    case "cta":
      return <CtaSection key={model.id} model={model} locale={locale} />;
  }
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale: localeInput } = await params;

  if (!isLocale(localeInput)) {
    notFound();
  }

  const [dictionary, result] = await Promise.all([
    getDictionary(localeInput),
    loadHomePageData(localeInput),
  ]);

  if (result.status === "error") {
    return (
      <main id="main-content" className="server-error-state">
        <div className="marketing-container">
          <h1>粤首</h1>
          <div role="alert">
            <h2>{dictionary.marketing.errors.contentUnavailable}</h2>
            <p>{dictionary.marketing.errors.retry}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!result.page) {
    notFound();
  }

  const model = createMarketingHomePageViewModel(result.page, dictionary);
  const sections = model.sections
    .filter((section) => section.enabled)
    .toSorted((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));

  return (
    <main id="main-content">
      <h1 className="visually-hidden">{model.title}</h1>
      {sections.map((section) => renderSection(section, model.locale, model.labels))}
    </main>
  );
}
