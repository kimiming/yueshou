import Image from "next/image";
import Link from "next/link";

import { localizeHref } from "@/components/marketing/link-utils";
import { HeroCarouselControls } from "@/components/marketing/sections/hero-carousel-controls";
import type { MarketingSectionViewModel } from "@/components/marketing/types";
import type { Locale } from "@/lib/i18n/config";

type HeroSectionProps = {
  model: MarketingSectionViewModel;
  locale: Locale;
  slogan: string;
  primaryHeading?: boolean;
};

export function HeroSection({ model, locale, slogan, primaryHeading = false }: HeroSectionProps) {
  if (!model.enabled) {
    return null;
  }

  const Heading = primaryHeading ? "h1" : "h2";

  return (
    <section className="hero-section" data-section={model.type} aria-labelledby={`${model.id}-title`}>
      {model.media ? (
        <Image
          className="hero-section__media"
          src={model.media.src}
          alt={model.media.alt}
          fill
          priority={primaryHeading}
          sizes="100vw"
        />
      ) : null}
      <div className="hero-section__mesh" aria-hidden="true" />
      <div className="marketing-container hero-section__inner">
        <div className="hero-section__content">
          {model.eyebrow ? <p className="section-eyebrow">{model.eyebrow}</p> : null}
          <Heading id={`${model.id}-title`}>{model.title}</Heading>
          <p className="hero-section__body">{model.body}</p>
          <p className="hero-section__slogan">{slogan}</p>
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
          <span className="hero-section__science-label">Peptide workflow</span>
          <ol>
            <li><span>01</span> Plan</li>
            <li><span>02</span> Synthesize</li>
            <li><span>03</span> Analyze</li>
            <li><span>04</span> Review</li>
          </ol>
          <HeroCarouselControls slides={model.items} />
        </aside>
      </div>
    </section>
  );
}
