import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ContentLanguageFallbackNotice } from "@/components/marketing/content-language-fallback";
import { RichContent } from "@/components/marketing/rich-content";
import { getApprovedLegalPageBySlug } from "@/features/content/service";
import { isLegalPageSlug } from "@/features/content/public-slug";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/features/seo/metadata";

export const dynamic = "auto";

type LegalPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: LegalPageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isLegalPageSlug(slug)) notFound();
  const page = await getApprovedLegalPageBySlug(locale, slug);
  if (!page) notFound();
  return buildMetadata({
    locale,
    contentLocale: page.translationLocale,
    path: `/legal/${slug}`,
    title: page.seoTitle?.trim() || page.title,
    description: page.seoDescription,
  });
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isLegalPageSlug(slug)) notFound();
  const [page, dictionary] = await Promise.all([getApprovedLegalPageBySlug(locale, slug), getDictionary(locale)]);
  if (!page) notFound();

  return (
    <main id="main-content" className="marketing-container">
      <Breadcrumbs label={dictionary.marketing.public.breadcrumbs} items={[
        { label: dictionary.navigation.home, href: `/${locale}` },
        { label: page.title },
      ]} />
      <article lang={page.translationLocale}>
        <ContentLanguageFallbackNotice usedFallback={page.usedFallback} message={dictionary.marketing.accessibility.fallbackNotice} />
        <h1>{page.title}</h1>
        <RichContent html={page.body} />
      </article>
    </main>
  );
}
