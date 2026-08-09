"use client";

import { useState } from "react";

import type { MarketingSectionItemViewModel } from "@/components/marketing/types";

type HeroCarouselControlsProps = {
  slides: MarketingSectionItemViewModel[];
  carouselLabel: string;
  carouselRole: string;
  chooseLabel: string;
  showSlideTemplate: string;
};

export function HeroCarouselControls({
  slides,
  carouselLabel,
  carouselRole,
  chooseLabel,
  showSlideTemplate,
}: HeroCarouselControlsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (slides.length < 2) {
    return null;
  }

  const activeSlide = slides[activeIndex];

  return (
    <div className="hero-carousel" role="region" aria-roledescription={carouselRole} aria-label={carouselLabel}>
      <div className="hero-carousel__slide" aria-live="polite">
        <strong>{activeSlide.title}</strong>
        {activeSlide.body ? <span>{activeSlide.body}</span> : null}
      </div>
      <div className="hero-carousel__controls" aria-label={chooseLabel}>
        {slides.map((slide, index) => (
          <button
            type="button"
            key={slide.id}
            aria-label={showSlideTemplate
              .replace("{number}", String(index + 1))
              .replace("{title}", slide.title)}
            aria-pressed={index === activeIndex}
            onClick={() => setActiveIndex(index)}
          >
            <span aria-hidden="true">{index + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
