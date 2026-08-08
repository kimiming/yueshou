export const LEGAL_PAGE_SLUGS = [
  "terms",
  "privacy",
  "ruo-policy",
  "shipping-compliance",
  "cookie-policy",
] as const;

export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number];

const legalPageSlugs = new Set<string>(LEGAL_PAGE_SLUGS);
const reservedPageSlugs = new Set<string>([
  "admin",
  "api",
  "preview",
  "home",
  "about",
  "contact",
  "products",
  "news",
  "services",
  "legal",
  "request-a-quote",
  "search",
  ...LEGAL_PAGE_SLUGS,
]);
const publicSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isPublicContentSlug(value: string) {
  return publicSlugPattern.test(value);
}

export function isLegalPageSlug(value: string): value is LegalPageSlug {
  return legalPageSlugs.has(value);
}

export function isGenericPageSlug(value: string) {
  return isPublicContentSlug(value) && !reservedPageSlugs.has(value);
}
