import Link from "next/link";

import { SectionFrame } from "@/components/marketing/sections/section-frame";
import type { MarketingSectionViewModel } from "@/components/marketing/types";

export function ServicesSection({ model }: { model: MarketingSectionViewModel }) {
  return (
    <SectionFrame model={model} className="marketing-section--services">
      {model.items.length > 0 ? (
        <div className="card-grid card-grid--four">
          {model.items.map((item, index) => (
            <article className="feature-card" key={item.id}>
              <span className="feature-card__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              {item.body ? <p>{item.body}</p> : null}
              {item.href ? <Link href={item.href}>Explore <span aria-hidden="true">→</span></Link> : null}
            </article>
          ))}
        </div>
      ) : null}
    </SectionFrame>
  );
}
