"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type { ShowcaseProduct } from "@/features/content/showcase-products";

const PAGE_SIZE = 10;

type HomeProductShowcaseProps = {
  locale: string;
  products: ShowcaseProduct[];
  maxPages?: number;
  moreHref?: string;
  moreLabel?: string;
};

export function HomeProductShowcase({ locale, products, maxPages, moreHref, moreLabel = "More" }: HomeProductShowcaseProps) {
  const [page, setPage] = useState(0);
  const availablePageCount = Math.ceil(products.length / PAGE_SIZE);
  const pageCount = maxPages ? Math.min(maxPages, availablePageCount) : availablePageCount;
  const visible = products.slice(page * PAGE_SIZE, Math.min((page + 1) * PAGE_SIZE, pageCount * PAGE_SIZE));

  if (!products.length) return null;

  return (
    <section className="marketing-section home-product-showcase" aria-label="Featured products">
      <div className="marketing-container">
        <div className="home-product-showcase__grid">
          {visible.map((product) => (
            <Link className="home-product-card" href={`/${locale}/products/${product.slug}`} key={product.slug}>
              <span className="home-product-card__media">
                <Image src={product.image.src} alt={product.image.alt} fill sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1100px) calc(50vw - 40px), 220px" />
              </span>
              <strong>{product.title}</strong>
            </Link>
          ))}
        </div>
        {pageCount > 1 ? (
          <nav className="home-product-showcase__pagination" aria-label="Product pages">
            {Array.from({ length: pageCount }, (_, index) => (
              <button type="button" aria-label={`Product page ${index + 1}`} aria-current={page === index ? "page" : undefined} onClick={() => setPage(index)} key={index}>
                <span className="visually-hidden">Product page </span>{index + 1}
              </button>
            ))}
          </nav>
        ) : null}
        {moreHref ? <div className="home-product-showcase__more"><Link href={moreHref}>{moreLabel} →</Link></div> : null}
      </div>
    </section>
  );
}
