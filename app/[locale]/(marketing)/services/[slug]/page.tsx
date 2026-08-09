import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ContentLanguageFallbackNotice } from "@/components/marketing/content-language-fallback";
import { RichContent } from "@/components/marketing/rich-content";
import { SeoJsonLd } from "@/components/marketing/seo-json-ld";
import { getPublishedService } from "@/features/content/service";
import { serviceJsonLd } from "@/features/seo/json-ld";
import { buildMetadata } from "@/features/seo/metadata";
import { isPublicContentSlug } from "@/features/content/public-slug";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "auto";

type ServicePageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: ServicePageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isPublicContentSlug(slug)) notFound();
  const service = await getPublishedService(locale, slug);
  if (!service) notFound();
  return buildMetadata({ locale, contentLocale: service.translationLocale, path: `/services/${slug}`, title: service.title });
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isPublicContentSlug(slug)) notFound();
  const service = await getPublishedService(locale, slug);
  if (!service) notFound();
  const dictionary = await getDictionary(locale);

  return (
    <main id="main-content" className="marketing-container">
      <SeoJsonLd data={serviceJsonLd(service)} />
      <Breadcrumbs label={dictionary.marketing.public.breadcrumbs} items={[
        { label: dictionary.navigation.home, href: `/${locale}` },
        { label: dictionary.navigation.services },
        { label: service.title },
      ]} />
      <article lang={service.translationLocale}>
        <ContentLanguageFallbackNotice usedFallback={service.usedFallback} message={dictionary.marketing.accessibility.fallbackNotice} />
        <h1>{service.title}</h1>
        <RichContent html={service.body} />
      </article>
    </main>
  );
}
