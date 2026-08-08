import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { RichContent } from "@/components/marketing/rich-content";
import { SeoJsonLd } from "@/components/marketing/seo-json-ld";
import { getPublishedProduct } from "@/features/content/service";
import { productJsonLd } from "@/features/seo/json-ld";
import { buildMetadata } from "@/features/seo/metadata";
import { isPublicContentSlug } from "@/features/content/public-slug";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: ProductPageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isPublicContentSlug(slug)) notFound();
  const product = await getPublishedProduct(locale, slug);
  if (!product) notFound();
  return buildMetadata({ locale, path: `/products/${slug}`, title: product.title });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isPublicContentSlug(slug)) notFound();
  const product = await getPublishedProduct(locale, slug);
  if (!product) notFound();
  const dictionary = await getDictionary(locale);

  return (
    <main id="main-content" className="marketing-container">
      <SeoJsonLd
        data={productJsonLd({
          locale: product.locale,
          slug: product.slug,
          title: product.title,
          category: product.category.title,
          casNumber: product.casNumber,
        })}
      />
      <Breadcrumbs label={dictionary.marketing.public.breadcrumbs} items={[
        { label: dictionary.navigation.home, href: `/${locale}` },
        { label: dictionary.navigation.products, href: `/${locale}/products` },
        { label: product.title },
      ]} />
      <article>
        <p>{product.category.title}</p>
        <h1>{product.title}</h1>
        {(product.casNumber || product.sequence) ? (
          <dl>
            {product.casNumber ? <div><dt>{dictionary.marketing.public.cas}</dt><dd>{product.casNumber}</dd></div> : null}
            {product.sequence ? <div><dt>{dictionary.marketing.public.sequence}</dt><dd>{product.sequence}</dd></div> : null}
          </dl>
        ) : null}
        <RichContent html={product.body} />
      </article>
    </main>
  );
}
