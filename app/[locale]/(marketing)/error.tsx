"use client";

import { useParams } from "next/navigation";

import { MarketingErrorState } from "@/components/marketing/content-language-fallback";
import { isLocale, type Locale } from "@/lib/i18n/config";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import zhCN from "@/messages/zh-CN.json";

const errorCopy = {
  en: en.marketing.errors,
  "zh-CN": zhCN.marketing.errors,
  de: de.marketing.errors,
  fr: fr.marketing.errors,
  es: es.marketing.errors,
} satisfies Record<Locale, typeof en.marketing.errors>;

export default function MarketingError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale && isLocale(params.locale) ? params.locale : "en";
  const copy = errorCopy[locale];
  return (
    <main id="main-content" className="server-error-state">
      <MarketingErrorState title={copy.contentUnavailable} retryLabel={copy.retry} onRetry={reset} />
    </main>
  );
}
