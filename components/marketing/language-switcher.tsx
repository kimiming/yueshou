import Link from "next/link";

import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";

const languageNames: Record<Locale, string> = {
  en: "English",
  "zh-CN": "简体中文",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};

type LanguageSwitcherProps = {
  locale: Locale;
  label: string;
  currentPath?: string;
};

function localizedPath(currentPath: string, locale: Locale) {
  const normalized = currentPath.startsWith("/") ? currentPath : `/${currentPath}`;
  const segments = normalized.split("/");
  const currentLocaleIndex = segments.findIndex((segment) =>
    (SUPPORTED_LOCALES as readonly string[]).includes(segment),
  );

  if (currentLocaleIndex >= 0) {
    segments[currentLocaleIndex] = locale;
    return segments.join("/") || `/${locale}`;
  }

  return `/${locale}${normalized === "/" ? "" : normalized}`;
}

export function LanguageSwitcher({ locale, label, currentPath = `/${locale}` }: LanguageSwitcherProps) {
  return (
    <nav className="language-switcher" aria-label={label}>
      <ul>
        {SUPPORTED_LOCALES.map((candidate) => (
          <li key={candidate}>
            <Link
              href={localizedPath(currentPath, candidate)}
              hrefLang={candidate}
              lang={candidate}
              aria-current={candidate === locale ? "page" : undefined}
            >
              {languageNames[candidate]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
