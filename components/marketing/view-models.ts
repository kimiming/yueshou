import type {
  MarketingShellContentViewModel,
  PageViewModel,
} from "@/features/content/view-models";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localizeHref } from "@/components/marketing/link-utils";
import { plainTextExcerpt } from "@/components/marketing/rich-content";
import { publicMediaUrl } from "@/features/media/public-url";
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
      body: item.body
        ? plainTextExcerpt(item.body, section.type === "capabilities" ? 1_000 : 240)
        : undefined,
      value: item.value,
      href: item.href ? localizeHref(item.href, section.locale) : undefined,
      media: item.media ? { src: publicMediaUrl(item.media.id), alt: item.media.alt } : undefined,
    })),
    media: section.media ? {
      src: publicMediaUrl(section.media.id),
      alt: section.media.alt,
    } : undefined,
    mediaGallery: section.mediaGallery.map((media) => ({
      src: publicMediaUrl(media.id),
      alt: media.alt,
    })),
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
  const localizeNavigation = (item: MarketingShellContentViewModel["navigation"][number]): MarketingShellViewModel["navigation"][number] => ({
    ...item,
    href: localizeHref(item.href, content.locale),
    children: item.children?.map(localizeNavigation),
  });
  const mediaSource = (media: MarketingShellContentViewModel["logo"]) => media ? {
    src: publicMediaUrl(media.id),
    alt: media.alt,
  } : undefined;
  return {
    locale: content.locale,
    brandName: content.brandName || "粤首",
    slogan: content.slogan || BRAND_SLOGAN,
    logo: mediaSource(content.logo),
    socialLinks: content.socialLinks ?? [],
    defaultSeo: content.defaultSeo,
    footerColumns: (content.footerColumns ?? []).map((column) => ({
      ...column,
      links: column.links.map((link) => ({ ...link, href: localizeHref(link.href, content.locale) })),
    })),
    primaryNavigationLabel: dictionary.marketing.navigation.primary,
    homeLabel: dictionary.marketing.accessibility.home,
    navigation: content.navigation.map(localizeNavigation),
    contact: content.contact,
    quoteLabel: dictionary.actions.requestQuote,
    searchLabel: dictionary.marketing.public.search,
    emailLabel: dictionary.marketing.accessibility.email,
    phoneLabel: dictionary.marketing.accessibility.phone,
    socialLinksLabel: dictionary.marketing.accessibility.socialLinks,
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
    copyright: `© ${new Date().getUTCFullYear()} ${content.brandName || "粤首"}`,
    cookieSettingsLabel: dictionary.consent.manage,
  };
}
