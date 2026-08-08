import Image from "next/image";
import Link from "next/link";

import { localizeHref } from "@/components/marketing/link-utils";
import { HeroCarouselControls } from "@/components/marketing/sections/hero-carousel-controls";
import type { MarketingSectionViewModel } from "@/components/marketing/types";
import type { Locale } from "@/lib/i18n/config";

type HeroSectionProps = {
  model: MarketingSectionViewModel;
  locale: Locale;
  labels: {
    workflow: string;
    workflowSteps: string[];
    carousel: string;
    chooseHighlight: string;
  };
};

export function HeroSection({ model, locale, labels }: HeroSectionProps) {
  if (!model.enabled) {
    return null;
  }

  return (
    <section className="hero-section" data-section={model.type} aria-labelledby={`${model.id}-title`}>
      {model.media ? (
        <Image
          className="hero-section__media"
          src={model.media.src}
          alt={model.media.alt}
          fill
          priority
          sizes="100vw"
        />
      ) : null}
      <div className="hero-section__mesh" aria-hidden="true" />
      <div className="marketing-container hero-section__inner">
        <div className="hero-section__content">
          {model.eyebrow ? <p className="section-eyebrow">{model.eyebrow}</p> : null}
          <h2 id={`${model.id}-title`}>{model.title}</h2>
          <p className="hero-section__body">{model.body}</p>
          <div className="hero-section__actions">
            {model.primaryCta ? (
              <Link className="button-link" href={localizeHref(model.primaryCta.href, locale)}>
                {model.primaryCta.label}
              </Link>
            ) : null}
            {model.secondaryCta ? (
              <Link className="text-link" href={localizeHref(model.secondaryCta.href, locale)}>
                {model.secondaryCta.label}<span aria-hidden="true"> →</span>
              </Link>
            ) : null}
          </div>
        </div>
        <aside className="hero-section__science-card" aria-label="Scientific workflow">
          <span className="hero-section__science-label">{labels.workflow}</span>
          <ol>
            {labels.workflowSteps.map((step, index) => (
              <li key={step}><span>{String(index + 1).padStart(2, "0")}</span> {step}</li>
            ))}
          </ol>
          <HeroCarouselControls
            slides={model.items}
            carouselLabel={labels.carousel}
            chooseLabel={labels.chooseHighlight}
          />
        </aside>
      </div>
    </section>
  );
}
