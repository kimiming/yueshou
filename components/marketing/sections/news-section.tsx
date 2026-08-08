import Link from "next/link";

import { SectionFrame } from "@/components/marketing/sections/section-frame";
import type { MarketingSectionViewModel } from "@/components/marketing/types";

export function NewsSection({ model }: { model: MarketingSectionViewModel }) {
  return (
    <SectionFrame model={model} className="marketing-section--news">
      {model.items.length > 0 ? (
        <div className="card-grid card-grid--three">
          {model.items.map((item) => (
            <article className="news-preview" key={item.id}>
              <span className="news-preview__label">Research update</span>
              <h3>{item.title}</h3>
              {item.body ? <p>{item.body}</p> : null}
              {item.href ? <Link href={item.href}>Read more →</Link> : null}
            </article>
          ))}
        </div>
      ) : null}
    </SectionFrame>
  );
}
