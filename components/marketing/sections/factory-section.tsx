import Image from "next/image";

import type { MarketingSectionViewModel } from "@/components/marketing/types";

export function FactorySection({ model }: { model: MarketingSectionViewModel }) {
  const images = model.mediaGallery ?? [];
  if (!model.enabled || images.length === 0) return null;

  return (
    <section className="marketing-section factory-section" data-section={model.type} aria-labelledby={`${model.id}-title`}>
      <div className="marketing-container factory-section__heading">
        <h2 id={`${model.id}-title`}>{model.title}</h2>
        {model.body ? <p>{model.body}</p> : null}
      </div>
      <div className="factory-gallery" role="region" aria-label={model.title}>
        <div className="factory-gallery__track">
          {[false, true].map((duplicate) => (
            <div className="factory-gallery__group" key={duplicate ? "duplicate" : "original"} aria-hidden={duplicate || undefined}>
              {images.map((media, index) => (
                <div className="factory-gallery__item" key={`${duplicate ? "duplicate" : "original"}-${media.src}-${index}`}>
                  <Image src={media.src} alt={duplicate ? "" : media.alt} fill sizes="(max-width: 720px) 78vw, 32vw" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
