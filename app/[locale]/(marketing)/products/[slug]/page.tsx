import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { RichContent } from "@/components/marketing/rich-content";
import { getPublishedProduct } from "@/features/content/service";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  let product;
  try {
    product = await getPublishedProduct(locale, slug);
  } catch {
    notFound();
  }
  if (!product) notFound();
  const dictionary = await getDictionary(locale);

  return (
    <main id="main-content" className="marketing-container">
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
