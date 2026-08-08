import type { Metadata } from "next";
import { z } from "zod";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/i18n/config";

export const SITE_NAME = "粤首";
export const SITE_ALTERNATE_NAME = "YueShou";
export const SITE_DESCRIPTION =
  "Precision Peptide Synthesis for Global Scientific Research";

const publicSiteEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z
    .string({ error: "NEXT_PUBLIC_SITE_URL is required" })
    .url("NEXT_PUBLIC_SITE_URL must be a valid URL")
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "NEXT_PUBLIC_SITE_URL must use http or https"),
});

const openGraphLocale: Record<Locale, string> = {
  en: "en_US",
  "zh-CN": "zh_CN",
  de: "de_DE",
  fr: "fr_FR",
  es: "es_ES",
};

type BaseMetadataInput = {
  locale: Locale;
  path: string;
  title: string;
  description?: string | null;
  noIndex?: boolean;
};

export type BuildMetadataInput = BaseMetadataInput & (
  | { kind: "article"; publishedTime: string }
  | { kind?: "website"; publishedTime?: never }
);

export function getSiteUrl(): URL {
  const { NEXT_PUBLIC_SITE_URL } = publicSiteEnvSchema.parse(process.env);
  const siteUrl = new URL(NEXT_PUBLIC_SITE_URL);
  siteUrl.hash = "";
  siteUrl.search = "";
  siteUrl.pathname = `${siteUrl.pathname.replace(/\/+$/, "")}/`;
  return siteUrl;
}

export function absoluteSiteUrl(path = "/"): string {
  const siteUrl = getSiteUrl();
  const basePath = siteUrl.pathname.replace(/\/+$/, "");
  const requestedPath = path.replace(/^\/+/, "");
  siteUrl.pathname = requestedPath
    ? `${basePath}/${requestedPath}`.replace(/\/{2,}/g, "/")
    : `${basePath}/`.replace(/\/{2,}/g, "/");
  return siteUrl.toString();
}

export function localizedAbsoluteUrl(locale: Locale, path: string): string {
  const routePath = path === "/" ? "" : path.replace(/^\/+|\/+$/g, "");
  return absoluteSiteUrl(`/${locale}${routePath ? `/${routePath}` : ""}`);
}

export function buildLanguageAlternates(path: string): Record<string, string> {
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, localizedAbsoluteUrl(locale, path)]),
  );
  return {
    ...languages,
    "x-default": localizedAbsoluteUrl(DEFAULT_LOCALE, path),
  };
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  if (input.kind === "article" && !input.publishedTime) {
    throw new Error("Article metadata requires publishedTime");
  }
  const description = input.description?.trim() || SITE_DESCRIPTION;
  const canonical = localizedAbsoluteUrl(input.locale, input.path);
  const imageUrl = absoluteSiteUrl("/og.png");
  const imageAlt = `${SITE_NAME} — ${SITE_DESCRIPTION}`;
  const commonOpenGraph = {
    title: input.title,
    description,
    url: canonical,
    siteName: SITE_NAME,
    locale: openGraphLocale[input.locale],
    alternateLocale: SUPPORTED_LOCALES
      .filter((locale) => locale !== input.locale)
      .map((locale) => openGraphLocale[locale]),
    images: [
      {
        url: imageUrl,
        width: 1730,
        height: 909,
        alt: imageAlt,
      },
    ],
  };

  const openGraph: Metadata["openGraph"] = input.kind === "article"
    ? {
        ...commonOpenGraph,
        type: "article",
        publishedTime: input.publishedTime,
      }
    : { ...commonOpenGraph, type: "website" };

  return {
    metadataBase: getSiteUrl(),
    title: input.title,
    description,
    alternates: {
      canonical,
      languages: buildLanguageAlternates(input.path),
    },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description,
      images: [imageUrl],
    },
    ...(input.noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
