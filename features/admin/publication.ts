import { pageSectionSchema, translationSchema } from "@/features/content/schemas";

type PublicationSection = {
  id: string;
  isEnabled: boolean;
  type: string;
  config: unknown;
  translations: Array<{ locale: string; title: string; body: string }>;
};

function requireEnglish(translations: Array<{ locale: string; title: string; body: string }>, label: string) {
  const english = translations.find((translation) => translation.locale === "en");
  if (!english || !english.title.trim() || !english.body.trim()) {
    throw new Error(`English translation is required for ${label}`);
  }
}

export function validatePagePublication(input: {
  translations: Array<{ locale: string; title: string; body: string }>;
  sections: PublicationSection[];
}) {
  requireEnglish(input.translations, "the page");
  for (const section of input.sections) {
    if (!section.isEnabled) continue;
    const parsed = pageSectionSchema.safeParse({ type: section.type, config: section.config });
    if (!parsed.success) throw new Error(`Invalid ${section.type} section configuration`);
    const translations = section.translations.map((translation) => translationSchema.parse(translation));
    requireEnglish(translations, `enabled section ${section.id}`);
  }
}
