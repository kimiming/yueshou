"use client";

import { useState } from "react";

import type { MarketingSectionItemViewModel } from "@/components/marketing/types";

type HeroCarouselControlsProps = {
  slides: MarketingSectionItemViewModel[];
};

export function HeroCarouselControls({ slides }: HeroCarouselControlsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (slides.length < 2) {
    return null;
  }

  const activeSlide = slides[activeIndex];

  return (
    <div className="hero-carousel" aria-roledescription="carousel" aria-label="Featured research highlights">
      <div className="hero-carousel__slide" aria-live="polite">
        <strong>{activeSlide.title}</strong>
        {activeSlide.body ? <span>{activeSlide.body}</span> : null}
      </div>
      <div className="hero-carousel__controls" aria-label="Choose featured highlight">
        {slides.map((slide, index) => (
          <button
            type="button"
            key={slide.id}
            aria-label={`Show slide ${index + 1}: ${slide.title}`}
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
