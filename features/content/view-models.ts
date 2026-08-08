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
  config: unknown;
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
  publishedAt: string | null;
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
