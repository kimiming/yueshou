import Link from "next/link";
import Image from "next/image";

import { SectionFrame } from "@/components/marketing/sections/section-frame";
import type { MarketingSectionViewModel } from "@/components/marketing/types";

export function NewsSection({ model }: { model: MarketingSectionViewModel }) {
  return (
    <SectionFrame model={{ ...model, body: "" }} className="marketing-section--news">
      {model.items.length > 0 ? (
        <div className="home-news-list">
          {model.items.map((item) => (
            <article className="news-preview" key={item.id}>
              {item.href ? <Link className="news-preview__cover" href={item.href} aria-label={item.title}>{item.media ? <Image src={item.media.src} alt={item.media.alt || item.title} fill sizes="(max-width: 720px) 100vw, 360px" /> : <span aria-hidden="true" />}</Link> : null}
              <div className="news-preview__content">
                <h3>{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</h3>
                {item.body ? <p>{item.body}</p> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </SectionFrame>
  );
}
