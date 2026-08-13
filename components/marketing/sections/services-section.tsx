import Image from "next/image";
import type { CSSProperties } from "react";

import { SectionFrame } from "@/components/marketing/sections/section-frame";
import type { MarketingSectionViewModel } from "@/components/marketing/types";

export function ServicesSection({ model }: { model: MarketingSectionViewModel }) {
  return (
    <SectionFrame model={model} className="marketing-section--services">
      {model.items.length > 0 ? (
        <div className="card-grid card-grid--three services-card-grid">
          {model.items.map((item, index) => (
            <article className="feature-card service-image-card" key={item.id} style={{ "--card-index": index } as CSSProperties}>
              {model.mediaGallery?.[index] ? (
                <div className="service-image-card__media">
                  <Image
                    src={model.mediaGallery[index].src}
                    alt={model.mediaGallery[index].alt}
                    fill
                    sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1100px) calc(50vw - 36px), 380px"
                  />
                </div>
              ) : null}
              <div className="service-image-card__content">
                <h3>{item.title}</h3>
                {item.body ? <p>{item.body}</p> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </SectionFrame>
  );
}
