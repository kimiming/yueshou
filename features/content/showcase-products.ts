import type { ProductViewModel } from "@/features/content/view-models";
import { publicMediaUrl } from "@/features/media/public-url";
import { productCoverMedia } from "@/features/content/product-cover";

export type ShowcaseProduct = {
  slug: string;
  title: string;
  image: { src: string; alt: string };
};

const SHOWCASE_SLUG = /^zpc-(?:wrinklend|creasend)-(\d{3})s$/u;

export function toShowcaseProducts(products: ProductViewModel[]): ShowcaseProduct[] {
  return products
    .flatMap((product) => {
      const match = product.slug.match(SHOWCASE_SLUG);
      const media = productCoverMedia(product);
      if (!match || !media) return [];

      return [{
        order: Number(match[1]),
        slug: product.slug,
        title: product.title,
        image: { src: publicMediaUrl(media.id), alt: media.alt },
      }];
    })
    .toSorted((left, right) => left.order - right.order || left.slug.localeCompare(right.slug))
    .map(({ slug, title, image }) => ({ slug, title, image }));
}
