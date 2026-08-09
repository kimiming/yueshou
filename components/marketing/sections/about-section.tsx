import Image from "next/image";
import Link from "next/link";

import { SectionFrame } from "@/components/marketing/sections/section-frame";
import type { MarketingSectionViewModel } from "@/components/marketing/types";

export function AboutSection({ model }: { model: MarketingSectionViewModel }) {
  return (
    <SectionFrame model={model} className="marketing-section--about">
      <div className="split-panel">
        <div className="split-panel__visual">
          {model.media ? (
            <Image src={model.media.src} alt={model.media.alt} fill sizes="(max-width: 760px) 100vw, 50vw" />
          ) : <div className="molecule-field" aria-hidden="true" />}
        </div>
        <div className="split-panel__content">
          {model.items.map((item) => (
            <article key={item.id}>
              <h3>{item.title}</h3>
              {item.body ? <p>{item.body}</p> : null}
            </article>
          ))}
          {model.primaryCta ? <Link className="text-link" href={model.primaryCta.href}>{model.primaryCta.label} →</Link> : null}
        </div>
      </div>
    </SectionFrame>
  );
}
