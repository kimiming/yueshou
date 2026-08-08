import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ProductCard } from "@/components/marketing/product-card";
import { RichContent } from "@/components/marketing/rich-content";
import { getPageBySlug, getPublishedProducts } from "@/features/content/service";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function ProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [page, products, dictionary] = await Promise.all([
    getPageBySlug(locale, "products"),
    getPublishedProducts(locale),
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
        <div className="content-card-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      </section>
    </main>
  );
}
