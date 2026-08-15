import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ContentLanguageFallbackNotice } from "@/components/marketing/content-language-fallback";
import { ProductReferenceTable } from "@/components/marketing/product-reference-table";
import { RichContent } from "@/components/marketing/rich-content";
import { getPageBySlug } from "@/features/content/service";
import { buildMetadata } from "@/features/seo/metadata";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "auto";

type ServicesPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: ServicesPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const page = await getPageBySlug(locale, "services");
  if (!page) notFound();
  return buildMetadata({
    locale,
    contentLocale: page.translationLocale,
    path: "/services",
    title: page.seoTitle?.trim() || page.title,
    description: page.seoDescription,
  });
}

export default async function ServicesPage({ params }: ServicesPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [page, dictionary] = await Promise.all([
    getPageBySlug(locale, "services"),
    getDictionary(locale),
  ]);
  if (!page) notFound();

  return (
    <main id="main-content" className="marketing-container services-page">
      <Breadcrumbs label={dictionary.marketing.public.breadcrumbs} items={[
        { label: dictionary.navigation.home, href: `/${locale}` },
        { label: page.title },
      ]} />
      <div lang={page.translationLocale}>
        <ContentLanguageFallbackNotice usedFallback={page.usedFallback} message={dictionary.marketing.accessibility.fallbackNotice} />
        <header className="marketing-page-hero">
          <h1 className="marketing-page-title">{page.title}</h1>
          <RichContent html={page.body} className="marketing-page-hero__description" />
        </header>
      </div>
      <section className="services-product-reference" aria-label={dictionary.navigation.services}>
        <ProductReferenceTable />
      </section>
    </main>
  );
}
