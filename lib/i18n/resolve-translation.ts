export type ResolvedTranslation<T> = {
  value: T;
  usedFallback: boolean;
};

export function resolveTranslation<T extends { locale: string }>(
  items: readonly T[],
  locale: string,
): ResolvedTranslation<T> {
  const localizedValue = items.find((item) => item.locale === locale);

  if (localizedValue) {
    return { value: localizedValue, usedFallback: false };
  }

  const englishValue = items.find((item) => item.locale === "en");

  if (!englishValue) {
    throw new Error("English translation is required");
  }

  return { value: englishValue, usedFallback: true };
}
