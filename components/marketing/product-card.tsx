import Link from "next/link";

import { plainTextExcerpt } from "@/components/marketing/rich-content";
import type { ProductViewModel } from "@/features/content/view-models";

export function ProductCard({ product }: { product: ProductViewModel }) {
  return (
    <article className="content-card" lang={product.translationLocale}>
      <p className="content-card__meta">{product.category.title}</p>
      <h3><Link href={`/${product.locale}/products/${product.slug}`}>{product.title}</Link></h3>
      {product.body ? <p>{plainTextExcerpt(product.body)}</p> : null}
      {product.casNumber ? <dl><div><dt>CAS</dt><dd>{product.casNumber}</dd></div></dl> : null}
    </article>
  );
}
