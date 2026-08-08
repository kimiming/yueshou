import type { Locale } from "@/lib/i18n/config";
import {
  absoluteSiteUrl,
  localizedAbsoluteUrl,
  SITE_ALTERNATE_NAME,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "@/features/seo/metadata";

export type JsonLdValue = Record<string, unknown>;

type OrganizationSetting = {
  summary?: string | null;
  contact?: {
    email?: string;
    phone?: string;
    addressLines?: string[];
  };
};

type BreadcrumbItem = {
  name: string;
  url?: string;
};

type ArticleJsonLdInput = {
  locale: Locale;
  slug: string;
  title: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  imageUrl?: string | null;
};

type ServiceJsonLdInput = {
  locale: Locale;
  slug: string;
  title: string;
};

type ProductJsonLdInput = ServiceJsonLdInput & {
  category?: string | null;
  casNumber?: string | null;
};

function organizationId() {
  return `${absoluteSiteUrl()}#organization`;
}

function websiteId() {
  return `${absoluteSiteUrl()}#website`;
}

function absoluteItemUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return absoluteSiteUrl(url);
}

export function organizationJsonLd(setting: OrganizationSetting = {}): JsonLdValue {
  const addressLines = setting.contact?.addressLines?.filter(Boolean) ?? [];
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId(),
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAME,
    url: absoluteSiteUrl(),
    logo: absoluteSiteUrl("/og.png"),
    description: setting.summary?.trim() || SITE_DESCRIPTION,
    ...(setting.contact?.email ? { email: setting.contact.email } : {}),
    ...(setting.contact?.phone ? { telephone: setting.contact.phone } : {}),
    ...(addressLines.length
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: addressLines.join(", "),
          },
        }
      : {}),
  };
}

export function websiteJsonLd(): JsonLdValue {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId(),
    url: absoluteSiteUrl(),
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAME,
    description: SITE_DESCRIPTION,
    publisher: { "@id": organizationId() },
  };
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdValue {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: absoluteItemUrl(item.url) } : {}),
    })),
  };
}

export function articleJsonLd(article: ArticleJsonLdInput): JsonLdValue {
  const url = localizedAbsoluteUrl(article.locale, `/news/${article.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: article.title,
    ...(article.excerpt ? { description: article.excerpt } : {}),
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    ...(article.imageUrl ? { image: absoluteItemUrl(article.imageUrl) } : {}),
    mainEntityOfPage: { "@id": url },
    publisher: { "@id": organizationId() },
  };
}

export function serviceJsonLd(service: ServiceJsonLdInput): JsonLdValue {
  const url = localizedAbsoluteUrl(service.locale, `/services/${service.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: service.title,
    url,
    provider: { "@id": organizationId() },
  };
}

export function productJsonLd(product: ProductJsonLdInput): JsonLdValue {
  const url = localizedAbsoluteUrl(product.locale, `/products/${product.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.title,
    url,
    ...(product.category ? { category: product.category } : {}),
    ...(product.casNumber ? { identifier: product.casNumber } : {}),
    brand: { "@type": "Brand", name: SITE_NAME },
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
