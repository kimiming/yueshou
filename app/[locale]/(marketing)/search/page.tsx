import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ContentLanguageFallbackNotice } from "@/components/marketing/content-language-fallback";
import { normalizeSearchQuery, searchPublishedContent } from "@/features/content/search";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/features/seo/metadata";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

export async function generateMetadata({ params }: Pick<SearchPageProps, "params">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = await getDictionary(locale);
  return buildMetadata({
    locale,
    path: "/search",
    title: dictionary.marketing.public.search,
    noIndex: true,
  });
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const [{ locale }, queryParameters] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const rawQuery = Array.isArray(queryParameters.q) ? queryParameters.q[0] ?? "" : queryParameters.q ?? "";
  const query = normalizeSearchQuery(rawQuery);
  const [dictionary, results] = await Promise.all([
    getDictionary(locale),
    searchPublishedContent(locale, query),
  ]);

  return (
    <main id="main-content" className="marketing-container">
      <Breadcrumbs label={dictionary.marketing.public.breadcrumbs} items={[
        { label: dictionary.navigation.home, href: `/${locale}` },
        { label: dictionary.marketing.public.search },
      ]} />
      <h1>{dictionary.marketing.public.search}</h1>
      <form action={`/${locale}/search`} method="get" role="search">
        <label htmlFor="site-search">{dictionary.marketing.public.searchLabel}</label>
        <input id="site-search" name="q" type="search" maxLength={100} defaultValue={query} />
        <button type="submit">{dictionary.marketing.public.searchAction}</button>
      </form>
      {query ? (
        <section aria-labelledby="search-results-heading">
          <h2 id="search-results-heading">{dictionary.marketing.public.results}</h2>
          {results.length ? (
            <ol className="search-results">
              {results.map((result) => (
                <li key={`${result.type}-${result.id}`}>
                  <article lang={result.translationLocale}>
                    <ContentLanguageFallbackNotice usedFallback={result.usedFallback} message={dictionary.marketing.accessibility.fallbackNotice} />
                    <h3><Link href={result.href}>{result.title}</Link></h3>
                    {result.excerpt ? <p>{result.excerpt}</p> : null}
                  </article>
                </li>
              ))}
            </ol>
          ) : <p>{dictionary.marketing.public.noResults}</p>}
        </section>
      ) : null}
    </main>
  );
}
