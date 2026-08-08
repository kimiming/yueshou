import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { RichContent } from "@/components/marketing/rich-content";
import { getPublishedArticle } from "@/features/content/service";
import { isPublicContentSlug } from "@/features/content/public-slug";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function NewsArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isPublicContentSlug(slug)) notFound();
  const article = await getPublishedArticle(locale, slug);
  if (!article) notFound();
  const dictionary = await getDictionary(locale);

  return (
    <main id="main-content" className="marketing-container">
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
