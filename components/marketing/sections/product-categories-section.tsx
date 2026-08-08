import Link from "next/link";

import { SectionFrame } from "@/components/marketing/sections/section-frame";
import type { MarketingSectionViewModel } from "@/components/marketing/types";

export function ProductCategoriesSection({ model }: { model: MarketingSectionViewModel }) {
  return (
    <SectionFrame model={model} className="marketing-section--categories">
      {model.items.length > 0 ? (
        <div className="category-grid">
          {model.items.map((item) => (
            <article key={item.id}>
              <div className="category-grid__shape" aria-hidden="true" />
              <h3>{item.title}</h3>
              {item.body ? <p>{item.body}</p> : null}
              {item.href ? <Link href={item.href}>View category →</Link> : null}
            </article>
          ))}
        </div>
      ) : null}
    </SectionFrame>
  );
}
