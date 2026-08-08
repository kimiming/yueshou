import Link from "next/link";

import type { ProductViewModel } from "@/features/content/view-models";

export function ProductCard({ product }: { product: ProductViewModel }) {
  return (
    <article className="content-card">
      <p className="content-card__meta">{product.category.title}</p>
      <h3><Link href={`/${product.locale}/products/${product.slug}`}>{product.title}</Link></h3>
      <p>{product.body}</p>
      {product.casNumber ? <dl><div><dt>CAS</dt><dd>{product.casNumber}</dd></div></dl> : null}
    </article>
  );
}
