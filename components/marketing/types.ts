import type { Locale } from "@/lib/i18n/config";

export type MarketingLinkViewModel = {
  id: string;
  label: string;
  href: string;
  enabled: boolean;
  sortOrder: number;
};

export type MarketingContactViewModel = {
  email?: string;
  phone?: string;
  addressLines: string[];
};

export type MarketingShellViewModel = {
  locale: Locale;
  brandName: "粤首";
  slogan: string;
  primaryNavigationLabel: string;
  navigation: MarketingLinkViewModel[];
  contact: MarketingContactViewModel;
  quoteLabel: string;
  languageLabel: string;
  footerSummary: string;
  researchUseOnly: string;
  copyright: string;
};

export type MarketingCtaViewModel = {
  label: string;
  href: string;
};

export type MarketingMediaViewModel = {
  src: string;
  alt: string;
};

export type MarketingSectionItemViewModel = {
  id: string;
  title: string;
  body?: string;
  value?: string;
  href?: string;
};

export type MarketingSectionType =
  | "hero"
  | "services"
  | "about"
  | "capabilities"
  | "quality"
  | "product-categories"
  | "global-reach"
  | "stats"
  | "news"
  | "cta";

export type MarketingSectionViewModel = {
  id: string;
  type: MarketingSectionType;
  enabled: boolean;
  sortOrder: number;
  eyebrow?: string;
  title: string;
  body: string;
  items: MarketingSectionItemViewModel[];
  media?: MarketingMediaViewModel;
  primaryCta?: MarketingCtaViewModel;
  secondaryCta?: MarketingCtaViewModel;
};

export type MarketingHomePageViewModel = {
  locale: Locale;
  title: string;
  slogan: string;
  sections: MarketingSectionViewModel[];
};
