import Image from "next/image";

import type { MarketingSectionViewModel } from "@/components/marketing/types";

function splitAdvantageTitle(title: string) {
  const firstSpace = title.indexOf(" ");
  const highlightLength = firstSpace > 0 ? firstSpace : 2;
  return [title.slice(0, highlightLength), title.slice(highlightLength)] as const;
}

export function CapabilitiesSection({ model }: { model: MarketingSectionViewModel }) {
  if (!model.enabled) return null;

  return (
    <section className="marketing-section advantages-main-bg" data-section={model.type} aria-labelledby={`${model.id}-title`}>
      <div className="marketing-container">
        <div className="advantages-main-title">
          <h2 id={`${model.id}-title`}>{model.title}</h2>
        </div>
        <div className="advantages-container">
          {model.items.map((item, index) => {
            const media = model.mediaGallery?.[index];
            const [highlight, titleRest] = splitAdvantageTitle(item.title);
            return (
              <article className="advantage-item" key={item.id}>
                <div className="advantage-content">
                  <h3 className="advantage-title">
                    {media ? <Image className="advantage-title__icon" src={media.src} alt="" width={32} height={32} /> : null}
                    <span><span className="underline-text">{highlight}</span>{titleRest}</span>
                  </h3>
                  {item.body ? <p className="advantage-description">{item.body}</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
