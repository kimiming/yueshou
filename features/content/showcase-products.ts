import type { ProductViewModel } from "@/features/content/view-models";
import { publicMediaUrl } from "@/features/media/public-url";
import { productCoverMedia } from "@/features/content/product-cover";

export type ShowcaseProduct = {
  slug: string;
  title: string;
  image: { src: string; alt: string };
};

export function toShowcaseProducts(products: ProductViewModel[], limit?: number): ShowcaseProduct[] {
  const visibleProducts = limit === undefined ? products : products.slice(0, limit);
  return visibleProducts.map((product) => {
    const media = productCoverMedia(product);
    return {
      slug: product.slug,
      title: product.title,
      image: media
        ? { src: publicMediaUrl(media.id), alt: media.alt }
        : { src: "/og.png", alt: product.title },
    };
  });
}
