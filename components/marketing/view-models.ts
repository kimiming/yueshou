import type {
  MarketingShellContentViewModel,
  PageViewModel,
} from "@/features/content/view-models";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localizeHref } from "@/components/marketing/link-utils";
import type {
  MarketingCtaViewModel,
  MarketingHomePageViewModel,
  MarketingSectionViewModel,
  MarketingShellViewModel,
} from "@/components/marketing/types";

export const BRAND_SLOGAN = "Precision Peptide Synthesis for Global Scientific Research";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCta(value: unknown, locale: PageViewModel["locale"]): MarketingCtaViewModel | undefined {
  if (!isRecord(value) || typeof value.label !== "string" || typeof value.href !== "string") {
    return undefined;
  }
  return { label: value.label, href: localizeHref(value.href, locale) };
}

function mapSection(section: PageViewModel["sections"][number]): MarketingSectionViewModel {
  const config = isRecord(section.config) ? section.config : {};
  return {
    id: section.id,
    type: section.type,
    enabled: section.enabled,
    sortOrder: section.sortOrder,
    title: section.title,
    body: section.body,
    items: section.items.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body || undefined,
      value: item.value,
      href: item.href ? localizeHref(item.href, section.locale) : undefined,
    })),
    media: section.media ? {
      src: section.media.storageKey.startsWith("/")
        ? section.media.storageKey
        : `/${section.media.storageKey}`,
      alt: section.media.alt,
    } : undefined,
    primaryCta: readCta(config.primaryCta, section.locale),
    secondaryCta: readCta(config.secondaryCta, section.locale),
  };
}

export function createMarketingHomePageViewModel(
  page: PageViewModel,
  dictionary: Dictionary,
): MarketingHomePageViewModel {
  return {
    locale: page.locale,
    title: page.title,
    slogan: BRAND_SLOGAN,
    sections: page.sections.map(mapSection),
    labels: {
      workflow: dictionary.marketing.hero.workflow,
      workflowSteps: dictionary.marketing.hero.steps,
      scientificWorkflow: dictionary.marketing.accessibility.scientificWorkflow,
      carousel: dictionary.marketing.hero.carousel,
      carouselRole: dictionary.marketing.accessibility.carousel,
      chooseHighlight: dictionary.marketing.hero.choose,
      showSlideTemplate: dictionary.marketing.accessibility.showSlide,
      explore: dictionary.marketing.cards.explore,
      viewCategory: dictionary.marketing.cards.viewCategory,
      researchUpdate: dictionary.marketing.cards.researchUpdate,
      readMore: dictionary.marketing.cards.readMore,
      contentUnavailable: dictionary.marketing.errors.contentUnavailable,
      retry: dictionary.marketing.errors.retry,
    },
  };
}

export function createMarketingShellViewModel(
  content: MarketingShellContentViewModel,
  dictionary: Dictionary,
): MarketingShellViewModel {
  return {
    locale: content.locale,
    brandName: "粤首",
    slogan: BRAND_SLOGAN,
    primaryNavigationLabel: dictionary.marketing.navigation.primary,
    homeLabel: dictionary.marketing.accessibility.home,
    navigation: content.navigation.map((item) => ({
      ...item,
      href: localizeHref(item.href, content.locale),
    })),
    contact: content.contact,
    quoteLabel: dictionary.actions.requestQuote,
    languageLabel: dictionary.marketing.navigation.language,
    footerNavigationLabel: dictionary.marketing.navigation.footer,
    footerExploreLabel: dictionary.marketing.footer.explore,
    footerContactLabel: dictionary.marketing.footer.contact,
    contactTeamLabel: dictionary.marketing.footer.contactTeam,
    mobileMenuLabel: dictionary.marketing.mobile.menu,
    mobileCloseLabel: dictionary.marketing.mobile.close,
    mobileNavigationLabel: dictionary.marketing.accessibility.mobileNavigation,
    footerSummary: content.summary,
    researchUseOnly: dictionary.marketing.footer.researchUseOnly,
    copyright: `© ${new Date().getUTCFullYear()} 粤首`,
  };
}
