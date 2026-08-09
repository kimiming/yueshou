import type { Locale } from "@/lib/i18n/config";
import type { PageSectionType } from "@/features/content/types";

export type LocalizedViewModel = {
  locale: Locale;
  translationLocale: Locale;
  usedFallback: boolean;
  title: string;
  body: string;
};

export type PageSectionViewModel = LocalizedViewModel & {
  id: string;
  type: PageSectionType;
  position: number;
  sortOrder: number;
  enabled: boolean;
  config: unknown;
  items: HomepageSectionItemViewModel[];
  media: MediaViewModel | null;
  mediaGallery: MediaViewModel[];
};

export type HomepageSectionItemViewModel = LocalizedViewModel & {
  id: string;
  href?: string;
  value?: string;
};

export type PageViewModel = LocalizedViewModel & {
  id: string;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  sections: PageSectionViewModel[];
};

export type MediaViewModel = Omit<LocalizedViewModel, "body"> & {
  id: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  alt: string;
};

export type CategoryViewModel = LocalizedViewModel & {
  slug: string;
};

export type ArticleViewModel = LocalizedViewModel & {
  id: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string;
  category: CategoryViewModel;
  tags: Array<{ slug: string; name: string }>;
  coverMedia: MediaViewModel | null;
};

export type ProductViewModel = LocalizedViewModel & {
  id: string;
  slug: string;
  casNumber: string | null;
  sequence: string | null;
  specifications: unknown;
  publishedAt: string | null;
  category: CategoryViewModel;
  media: MediaViewModel[];
};

export type ServiceViewModel = LocalizedViewModel & {
  id: string;
  slug: string;
};

export type MarketingNavigationViewModel = {
  id: string;
  label: string;
  href: string;
  sortOrder: number;
  enabled: true;
  children?: MarketingNavigationViewModel[];
};

export type MarketingShellContentViewModel = {
  locale: Locale;
  translationLocale: Locale;
  usedFallback: boolean;
  summary: string;
  brandName?: string;
  slogan?: string;
  logo?: MediaViewModel | null;
  favicon?: MediaViewModel | null;
  socialLinks?: Array<{ label: string; href: string }>;
  defaultSeo?: { title: string; description: string; keywords: string[] };
  footerColumns?: Array<{ heading: string; links: Array<{ label: string; href: string }> }>;
  contact: {
    email?: string;
    phone?: string;
    addressLines: string[];
  };
  navigation: MarketingNavigationViewModel[];
};
