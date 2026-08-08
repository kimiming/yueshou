import { z } from "zod";

import { contentLocales, pageSectionTypes } from "@/features/content/types";

export const contentLocaleSchema = z.enum(contentLocales);

export const localeSchema = contentLocaleSchema;

export const translationSchema = z.object({
  locale: contentLocaleSchema,
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1),
});

export const publishableTranslationSchema = z
  .array(translationSchema)
  .superRefine((items, ctx) => {
    if (!items.some((item) => item.locale === "en")) {
      ctx.addIssue({
        code: "custom",
        message: "English translation is required",
      });
    }
  });

const isSafeCtaHref = (href: string) => {
  if (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")) {
    return true;
  }

  try {
    const url = new URL(href);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
};

const ctaSchema = z.object({
  label: z.string().trim().min(1).max(80),
  href: z.string().trim().refine(isSafeCtaHref, "Use a relative or HTTPS link"),
});

const pageSectionConfigSchemas = {
  hero: z.object({
    imageId: z.string().cuid().optional(),
    primaryCta: ctaSchema.optional(),
    secondaryCta: ctaSchema.optional(),
  }),
  services: z.object({ serviceIds: z.array(z.string().cuid()).max(12).optional() }),
  about: z.object({ imageId: z.string().cuid().optional() }),
  capabilities: z.object({ itemIds: z.array(z.string().cuid()).max(12).optional() }),
  quality: z.object({ imageId: z.string().cuid().optional() }),
  stats: z.object({
    items: z
      .array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(40) }))
      .max(8)
      .optional(),
  }),
  news: z.object({ count: z.number().int().min(1).max(12).default(3) }),
  cta: z.object({ primaryCta: ctaSchema }),
} satisfies Record<(typeof pageSectionTypes)[number], z.ZodType>;

export const pageSectionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), config: pageSectionConfigSchemas.hero }),
  z.object({ type: z.literal("services"), config: pageSectionConfigSchemas.services }),
  z.object({ type: z.literal("about"), config: pageSectionConfigSchemas.about }),
  z.object({ type: z.literal("capabilities"), config: pageSectionConfigSchemas.capabilities }),
  z.object({ type: z.literal("quality"), config: pageSectionConfigSchemas.quality }),
  z.object({ type: z.literal("stats"), config: pageSectionConfigSchemas.stats }),
  z.object({ type: z.literal("news"), config: pageSectionConfigSchemas.news }),
  z.object({ type: z.literal("cta"), config: pageSectionConfigSchemas.cta }),
]);
