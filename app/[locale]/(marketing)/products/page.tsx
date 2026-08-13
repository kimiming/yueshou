import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ContentLanguageFallbackNotice } from "@/components/marketing/content-language-fallback";
import { HomeProductShowcase } from "@/components/marketing/home-product-showcase";
import { getPageBySlug, getPublishedProducts } from "@/features/content/service";
import { toShowcaseProducts } from "@/features/content/showcase-products";
import { buildMetadata } from "@/features/seo/metadata";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "auto";

type ProductsPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: ProductsPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const page = await getPageBySlug(locale, "products");
  if (!page) notFound();
  return buildMetadata({ locale, contentLocale: page.translationLocale, path: "/products", title: page.seoTitle?.trim() || page.title, description: page.seoDescription });
}

export default async function ProductsPage({ params }: ProductsPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [page, products, dictionary] = await Promise.all([
    getPageBySlug(locale, "products"),
    getPublishedProducts(locale),
    getDictionary(locale),
  ]);
  if (!page) notFound();

  const showcaseProducts = toShowcaseProducts(products);

  return (
    <main id="main-content" className="marketing-container products-page">
      <Breadcrumbs label={dictionary.marketing.public.breadcrumbs} items={[{ label: dictionary.navigation.home, href: `/${locale}` }, { label: page.title }]} />
      <header lang={page.translationLocale}>
        <ContentLanguageFallbackNotice usedFallback={page.usedFallback} message={dictionary.marketing.accessibility.fallbackNotice} />
        <h1>{page.title}</h1>
      </header>
      <HomeProductShowcase locale={locale} products={showcaseProducts} label={dictionary.marketing.public.catalog} />
    </main>
  );
}
