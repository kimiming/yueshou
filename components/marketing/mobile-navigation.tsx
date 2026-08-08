"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { MarketingLinkViewModel } from "@/components/marketing/types";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";

type MobileNavigationProps = {
  label: string;
  items: MarketingLinkViewModel[];
  menuLabel: string;
  closeLabel: string;
};

export function MobileNavigation({ label, items, menuLabel, closeLabel }: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  return (
    <div className="mobile-navigation">
      <button
        type="button"
        className="mobile-navigation__toggle"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" className="mobile-navigation__icon">{open ? "×" : "☰"}</span>
        <span>{open ? closeLabel : menuLabel}</span>
      </button>
      {open ? (
        <nav id={menuId} className="mobile-navigation__panel" aria-label={`${label} mobile`}>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <Link href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

const languageNames: Record<Locale, string> = {
  en: "English",
  "zh-CN": "简体中文",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};

function localizedPath(pathname: string, locale: Locale) {
  const segments = pathname.split("/");
  if ((SUPPORTED_LOCALES as readonly string[]).includes(segments[1])) {
    segments[1] = locale;
    return segments.join("/") || `/${locale}`;
  }
  return `/${locale}${pathname === "/" ? "" : pathname}`;
}

export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname() || `/${locale}`;
  return (
    <nav className="language-switcher" aria-label={label}>
      <ul>
        {SUPPORTED_LOCALES.map((candidate) => (
          <li key={candidate}>
            <Link
              href={localizedPath(pathname, candidate)}
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
