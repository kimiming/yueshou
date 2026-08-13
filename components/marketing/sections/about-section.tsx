import Image from "next/image";
import Link from "next/link";

import type { MarketingSectionViewModel } from "@/components/marketing/types";

export function AboutSection({ model }: { model: MarketingSectionViewModel }) {
  if (!model.enabled) {
    return null;
  }

  const imageLabels = ["Research Peptides", "Pharmaceutical Peptides", "Cosmetic Peptides"];
  const content = (
    <div className="split-panel__content">
      {model.items.map((item) => (
        <article key={item.id}>
          <h3>{item.title}</h3>
          {item.body ? <p>{item.body}</p> : null}
        </article>
      ))}
      {model.primaryCta ? <Link className="text-link" href={model.primaryCta.href}>{model.primaryCta.label} →</Link> : null}
    </div>
  );
  const heading = (
    <div className="section-heading about-intro-layout__copy">
      {model.eyebrow ? <p className="section-eyebrow">{model.eyebrow}</p> : null}
      <h2 id={`${model.id}-title`}>{model.title}</h2>
      {model.body ? <p>{model.body}</p> : null}
      {model.items.length || model.primaryCta ? content : null}
    </div>
  );

  return (
    <section
      className="marketing-section marketing-section--about"
      data-section={model.type}
      aria-labelledby={`${model.id}-title`}
    >
      <div className="marketing-container">
        <div className="about-intro-layout">
          {heading}
          {model.media ? (
            <div className="split-panel about-intro-panel">
              <div className="split-panel__visual about-intro-panel__visual">
                <Image src={model.media.src} alt={model.media.alt} fill sizes="(max-width: 760px) 190px, 240px" />
              </div>
            </div>
          ) : null}
        </div>
        {!model.media && !model.items.length && !model.primaryCta ? (
          <div className="split-panel__visual">
            <div className="molecule-field" aria-hidden="true" />
          </div>
        ) : null}
        {model.mediaGallery?.length ? (
          <div className="about-image-gallery">
            {model.mediaGallery.map((media, index) => (
              <div className="about-image-gallery__item" key={media.src}>
                <Image src={media.src} alt={media.alt} fill sizes="(max-width: 760px) 100vw, 33vw" />
                {imageLabels[index] ? <h3 className="about-image-gallery__label">{imageLabels[index]}</h3> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
