import { describe, expect, it } from "vitest";

import {
  pageSectionSchema,
  publishableTranslationSchema,
} from "@/features/content/schemas";

describe("publishableTranslationSchema", () => {
  it("requires an English title and body", () => {
    const result = publishableTranslationSchema.safeParse([
      { locale: "de", title: "Peptide", body: "Text" },
    ]);

    expect(result.success).toBe(false);
  });

  it("accepts an English translation with an optional localized translation", () => {
    const result = publishableTranslationSchema.safeParse([
      { locale: "en", title: "Peptide", body: "Text" },
      { locale: "zh-CN", title: "肽", body: "文本" },
    ]);

    expect(result.success).toBe(true);
  });
});

describe("pageSectionSchema", () => {
  it("accepts only safe relative or HTTPS CTA URLs", () => {
    const parseCta = (href: string) =>
      pageSectionSchema.safeParse({
        type: "hero",
        config: { primaryCta: { label: "Request a quote", href } },
      }).success;

    expect(parseCta("/request-a-quote")).toBe(true);
    expect(parseCta("https://example.com/request-a-quote")).toBe(true);
    expect(parseCta("//evil.example")).toBe(false);
    expect(parseCta("https:example.com")).toBe(false);
    expect(parseCta("https:/example.com")).toBe(false);
    expect(parseCta("https://")).toBe(false);
    expect(parseCta("https://user:password@example.com/request-a-quote")).toBe(false);
  });

  it("accepts only approved structured section types", () => {
    expect(
      pageSectionSchema.safeParse({
        type: "hero",
        config: {
          primaryCta: { label: "Request a quote", href: "/en/contact" },
        },
      }).success,
    ).toBe(true);

    expect(
      pageSectionSchema.safeParse({
        type: "script",
        config: { code: "alert('unsafe')" },
      }).success,
    ).toBe(false);
  });
});
