import { notFound } from "next/navigation";

import { ArticleCard } from "@/components/marketing/article-card";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { RichContent } from "@/components/marketing/rich-content";
import { getPageBySlug, getPublishedArticles } from "@/features/content/service";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [page, articles, dictionary] = await Promise.all([
    getPageBySlug(locale, "news"),
    getPublishedArticles(locale),
    getDictionary(locale),
  ]);
  if (!page) notFound();

  return (
    <main id="main-content" className="marketing-container">
      <Breadcrumbs label={dictionary.marketing.public.breadcrumbs} items={[
        { label: dictionary.navigation.home, href: `/${locale}` },
        { label: page.title },
      ]} />
      <h1>{page.title}</h1>
      <RichContent html={page.body} />
      <section aria-labelledby="published-articles-heading">
        <h2 id="published-articles-heading">{dictionary.marketing.public.articles}</h2>
        <div className="content-card-grid">{articles.map((article) => <ArticleCard key={article.id} article={article} />)}</div>
      </section>
    </main>
  );
}
