import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { RichContent } from "@/components/marketing/rich-content";
import { getPageBySlug } from "@/features/content/service";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/features/seo/metadata";

export const dynamic = "force-dynamic";

type AboutPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: AboutPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const page = await getPageBySlug(locale, "about");
  if (!page) notFound();
  return buildMetadata({
    locale,
    path: "/about",
    title: page.seoTitle?.trim() || page.title,
    description: page.seoDescription,
  });
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [page, dictionary] = await Promise.all([getPageBySlug(locale, "about"), getDictionary(locale)]);
  if (!page) notFound();

  return (
    <main id="main-content" className="marketing-container about-page">
      <Breadcrumbs label={dictionary.marketing.public.breadcrumbs} items={[
        { label: dictionary.navigation.home, href: `/${locale}` },
        { label: page.title },
      ]} />
      <article className="about-page__article">
        <header className="marketing-page-hero">
          <h1 className="marketing-page-title">{page.title}</h1>
        </header>
        <RichContent html={page.body} className="about-page__content" />
      </article>
    </main>
  );
}
