import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { RichContent } from "@/components/marketing/rich-content";
import { SeoJsonLd } from "@/components/marketing/seo-json-ld";
import { getPublishedArticle } from "@/features/content/service";
import { articleJsonLd } from "@/features/seo/json-ld";
import { buildMetadata } from "@/features/seo/metadata";
import { isPublicContentSlug } from "@/features/content/public-slug";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

type NewsArticlePageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: NewsArticlePageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isPublicContentSlug(slug)) notFound();
  const article = await getPublishedArticle(locale, slug);
  if (!article) notFound();
  return buildMetadata({
    locale,
    path: `/news/${slug}`,
    title: article.title,
    description: article.excerpt,
    kind: "article",
    publishedTime: article.publishedAt,
  });
}

export default async function NewsArticlePage({ params }: NewsArticlePageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isPublicContentSlug(slug)) notFound();
  const article = await getPublishedArticle(locale, slug);
  if (!article) notFound();
  const dictionary = await getDictionary(locale);

  return (
    <main id="main-content" className="marketing-container">
      <SeoJsonLd data={articleJsonLd(article)} />
      <Breadcrumbs label={dictionary.marketing.public.breadcrumbs} items={[
        { label: dictionary.navigation.home, href: `/${locale}` },
        { label: dictionary.marketing.public.news, href: `/${locale}/news` },
        { label: article.title },
      ]} />
      <article>
        <p>{article.category.title}</p>
        <h1>{article.title}</h1>
        {article.publishedAt ? <time dateTime={article.publishedAt}>{new Intl.DateTimeFormat(locale).format(new Date(article.publishedAt))}</time> : null}
        <RichContent html={article.body} />
      </article>
    </main>
  );
}
