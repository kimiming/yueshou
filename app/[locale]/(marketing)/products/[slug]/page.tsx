import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ContentLanguageFallbackNotice } from "@/components/marketing/content-language-fallback";
import { RichContent } from "@/components/marketing/rich-content";
import { SeoJsonLd } from "@/components/marketing/seo-json-ld";
import { getPublishedProduct } from "@/features/content/service";
import { productJsonLd } from "@/features/seo/json-ld";
import { buildMetadata } from "@/features/seo/metadata";
import { isPublicContentSlug } from "@/features/content/public-slug";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { productCoverMedia } from "@/features/content/product-cover";
import { ProductGallery } from "@/components/marketing/product-gallery";
import { WHATSAPP_NUMBER } from "@/components/marketing/whatsapp-float";

export const dynamic = "auto";

type ProductPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: ProductPageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isPublicContentSlug(slug)) notFound();
  const product = await getPublishedProduct(locale, slug);
  if (!product) notFound();
  return buildMetadata({ locale, contentLocale: product.translationLocale, path: `/products/${slug}`, title: product.title });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isPublicContentSlug(slug)) notFound();
  const product = await getPublishedProduct(locale, slug);
  if (!product) notFound();
  const dictionary = await getDictionary(locale);
  const coverMedia = productCoverMedia(product);
  const gallery = coverMedia ? [coverMedia, ...product.media.filter((item) => item.id !== coverMedia.id)] : product.media;
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello, I would like to inquire about ${product.title}.`)}`;

  return (
    <main id="main-content" className="marketing-container product-detail-page">
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
      <article className="product-detail" lang={product.translationLocale}>
        <ContentLanguageFallbackNotice usedFallback={product.usedFallback} message={dictionary.marketing.accessibility.fallbackNotice} />
        <div className="product-detail__layout">
          <div className="product-detail__media">
            <ProductGallery media={gallery} />
          </div>
          <div className="product-detail__content">
            <p className="section-eyebrow">{product.category.title}</p>
            <h1>{product.title}</h1>
            {(product.casNumber || product.sequence) ? (
              <dl>
                {product.casNumber ? <div><dt>{dictionary.marketing.public.cas}</dt><dd>{product.casNumber}</dd></div> : null}
                {product.sequence ? <div><dt>{dictionary.marketing.public.sequence}</dt><dd>{product.sequence}</dd></div> : null}
              </dl>
            ) : null}
            <RichContent html={product.body} />
            <a className="product-detail__whatsapp" href={whatsappHref} target="_blank" rel="noopener noreferrer">Inquire on WhatsApp</a>
          </div>
        </div>
      </article>
    </main>
  );
}
