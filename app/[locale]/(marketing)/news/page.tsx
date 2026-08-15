import { notFound } from "next/navigation";

import { ArticleCard } from "@/components/marketing/article-card";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ContentLanguageFallbackNotice } from "@/components/marketing/content-language-fallback";
import { RichContent } from "@/components/marketing/rich-content";
import { getPageBySlug, getPublishedArticles } from "@/features/content/service";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/features/seo/metadata";
import Link from "next/link";

export const dynamic = "auto";

type NewsPageProps = { params: Promise<{ locale: string }>; searchParams?: Promise<{ page?: string }> };

export async function generateMetadata({ params }: NewsPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const page = await getPageBySlug(locale, "news");
  if (!page) notFound();
  return buildMetadata({
    locale,
    contentLocale: page.translationLocale,
    path: "/news",
    title: page.seoTitle?.trim() || page.title,
    description: page.seoDescription,
  });
}

export default async function NewsPage({ params, searchParams }: NewsPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const filters = await searchParams;
  const [page, catalog, dictionary] = await Promise.all([
    getPageBySlug(locale, "news"),
    getPublishedArticles(locale, filters?.page),
    getDictionary(locale),
  ]);
  if (!page) notFound();
  const articleCatalog = Array.isArray(catalog) ? { articles: catalog, page: 1, pageCount: 1 } : catalog;

  return (
    <main id="main-content" className="marketing-container news-page">
      <Breadcrumbs label={dictionary.marketing.public.breadcrumbs} items={[
        { label: dictionary.navigation.home, href: `/${locale}` },
        { label: page.title },
      ]} />
      <header className="marketing-page-hero" lang={page.translationLocale}>
        <ContentLanguageFallbackNotice usedFallback={page.usedFallback} message={dictionary.marketing.accessibility.fallbackNotice} />
        <h1 className="marketing-page-title">{page.title}</h1>
        <RichContent html={page.body} className="marketing-page-hero__description" />
      </header>
      <section aria-label={page.title}>
        <div className="news-list">{articleCatalog.articles.map((article) => <ArticleCard key={article.id} article={article} />)}</div>
        {articleCatalog.pageCount > 1 ? <nav className="news-pagination" aria-label="News pages">
          {Array.from({ length: articleCatalog.pageCount }, (_, index) => index + 1).map((number) => <Link key={number} href={`/${locale}/news?page=${number}`} aria-current={number === articleCatalog.page ? "page" : undefined}>{number}</Link>)}
        </nav> : null}
      </section>
    </main>
  );
}
