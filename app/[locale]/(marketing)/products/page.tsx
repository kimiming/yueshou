import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ProductCard } from "@/components/marketing/product-card";
import { RichContent } from "@/components/marketing/rich-content";
import { getPageBySlug, getProductCatalog } from "@/features/content/service";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/features/seo/metadata";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[]; category?: string | string[] }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: ProductsPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const page = await getPageBySlug(locale, "products");
  if (!page) notFound();
  return buildMetadata({
    locale,
    path: "/products",
    title: page.seoTitle?.trim() || page.title,
    description: page.seoDescription,
  });
}

export default async function ProductsPage({ params, searchParams }: ProductsPageProps) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const [page, catalog, dictionary] = await Promise.all([
    getPageBySlug(locale, "products"),
    getProductCatalog(locale, {
      query: first(filters.q),
      category: first(filters.category),
    }),
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
      <section aria-labelledby="product-catalog-heading">
        <h2 id="product-catalog-heading">{dictionary.marketing.public.catalog}</h2>
        <form action={`/${locale}/products`} method="get" role="search">
          <label htmlFor="product-query">{dictionary.marketing.public.searchLabel}</label>
          <input
            id="product-query"
            name="q"
            type="search"
            maxLength={100}
            defaultValue={catalog.query}
          />
          <label htmlFor="product-category">{dictionary.marketing.public.productCategory}</label>
          <select id="product-category" name="category" defaultValue={catalog.category ?? ""}>
            <option value="">{dictionary.marketing.public.allCategories}</option>
            {catalog.categories.map((category) => (
              <option value={category.slug} key={category.slug}>{category.title}</option>
            ))}
          </select>
          <button type="submit">{dictionary.marketing.public.applyFilters}</button>
          {catalog.query || catalog.category ? (
            <Link href={`/${locale}/products`}>{dictionary.marketing.public.clearFilters}</Link>
          ) : null}
        </form>
        {catalog.products.length ? (
          <div className="content-card-grid">
            {catalog.products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <p role="status">{dictionary.marketing.public.noProducts}</p>
        )}
      </section>
    </main>
  );
}
