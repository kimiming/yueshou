import type { PageViewModel } from "@/features/content/view-models";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import type {
  MarketingCtaViewModel,
  MarketingHomePageViewModel,
  MarketingLinkViewModel,
  MarketingMediaViewModel,
  MarketingSectionItemViewModel,
  MarketingSectionViewModel,
  MarketingShellViewModel,
} from "@/components/marketing/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCta(value: unknown): MarketingCtaViewModel | undefined {
  if (!isRecord(value) || typeof value.label !== "string" || typeof value.href !== "string") {
    return undefined;
  }

  return { label: value.label, href: value.href };
}

function readMedia(value: unknown): MarketingMediaViewModel | undefined {
  if (!isRecord(value) || typeof value.src !== "string" || typeof value.alt !== "string") {
    return undefined;
  }

  return { src: value.src, alt: value.alt };
}

function readItems(value: unknown): MarketingSectionItemViewModel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (!isRecord(item) || typeof item.title !== "string") {
      return [];
    }

    return [{
      id: typeof item.id === "string" ? item.id : `item-${index}`,
      title: item.title,
      body: typeof item.body === "string" ? item.body : undefined,
      value: typeof item.value === "string" ? item.value : undefined,
      href: typeof item.href === "string" ? item.href : undefined,
    }];
  });
}

function readStats(value: unknown): MarketingSectionItemViewModel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (!isRecord(item) || typeof item.label !== "string" || typeof item.value !== "string") {
      return [];
    }

    return [{ id: `stat-${index}`, title: item.label, value: item.value }];
  });
}

function mapSection(section: PageViewModel["sections"][number]): MarketingSectionViewModel {
  const config = isRecord(section.config) ? section.config : {};
  const items = section.type === "stats" ? readStats(config.items) : readItems(config.items);

  return {
    id: section.id,
    type: section.type,
    enabled: config.enabled !== false,
    sortOrder: section.position,
    eyebrow: typeof config.eyebrow === "string" ? config.eyebrow : undefined,
    title: section.title,
    body: section.body,
    items,
    media: readMedia(config.media),
    primaryCta: readCta(config.primaryCta),
    secondaryCta: readCta(config.secondaryCta),
  };
}

export function createMarketingHomePageViewModel(
  page: PageViewModel,
  dictionary: Dictionary,
): MarketingHomePageViewModel {
  return {
    locale: page.locale,
    title: page.title,
    slogan: dictionary.site.slogan,
    sections: page.sections.map(mapSection),
  };
}

const navigationKeys = ["home", "about", "services", "products", "quality", "contact"] as const;

function localizeNavigationHref(locale: Locale, key: (typeof navigationKeys)[number]) {
  return key === "home" ? `/${locale}` : `/${locale}/${key}`;
}

export function createMarketingShellViewModel(
  locale: Locale,
  dictionary: Dictionary,
  navigation?: MarketingLinkViewModel[],
): MarketingShellViewModel {
  const defaultNavigation = navigationKeys.map((key, index) => ({
    id: key,
    label: dictionary.navigation[key],
    href: localizeNavigationHref(locale, key),
    enabled: true,
    sortOrder: index * 10,
  }));

  return {
    locale,
    brandName: "粤首",
    slogan: dictionary.site.slogan,
    primaryNavigationLabel: "Primary navigation",
    navigation: navigation ?? defaultNavigation,
    contact: { addressLines: [] },
    quoteLabel: dictionary.actions.requestQuote,
    languageLabel: "Language",
    footerSummary: dictionary.site.slogan,
    researchUseOnly: "Research use only.",
    copyright: `© ${new Date().getUTCFullYear()} 粤首`,
  };
}
