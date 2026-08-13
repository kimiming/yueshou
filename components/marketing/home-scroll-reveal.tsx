"use client";

import { useLayoutEffect } from "react";

export function HomeScrollReveal() {
  useLayoutEffect(() => {
    if (typeof window.matchMedia !== "function" || typeof window.IntersectionObserver !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const main = document.querySelector<HTMLElement>("main[data-homepage]");
    if (!main) return;

    const sections = Array.from(main.querySelectorAll<HTMLElement>(":scope > section.marketing-section"));
    const pending = sections.filter((section) => section.getBoundingClientRect().top >= window.innerHeight * 0.9);
    if (!pending.length) return;

    pending.forEach((section) => section.classList.add("scroll-reveal--pending"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const section = entry.target as HTMLElement;
        section.classList.add("scroll-reveal--visible");
        observer.unobserve(section);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });

    const frame = window.requestAnimationFrame(() => pending.forEach((section) => observer.observe(section)));
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      pending.forEach((section) => section.classList.remove("scroll-reveal--pending", "scroll-reveal--visible"));
    };
  }, []);

  return null;
}
