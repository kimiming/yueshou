import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { ConsentRuntime } from "@/components/consent/analytics-consent-boundary";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { WhatsAppFloat } from "@/components/marketing/whatsapp-float";
import { MessageFloat } from "@/components/marketing/message-float";
import { SeoJsonLd } from "@/components/marketing/seo-json-ld";
import {
  BRAND_SLOGAN,
  createMarketingShellViewModel,
} from "@/components/marketing/view-models";
import { getMarketingShell } from "@/features/content/service";
import type { MarketingShellContentViewModel } from "@/features/content/view-models";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { organizationJsonLd, websiteJsonLd } from "@/features/seo/json-ld";
import { CONSENT_COOKIE_NAME, parseConsentCookie } from "@/features/consent/preferences";

type MarketingLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

type ShellResult =
  | { status: "ready"; content: MarketingShellContentViewModel }
  | { status: "error" };

async function loadShell(locale: Locale): Promise<ShellResult> {
  try {
    const content = await getMarketingShell(locale);
    return content ? { status: "ready", content } : { status: "error" };
  } catch {
    return { status: "error" };
  }
}

export default async function MarketingLayout({ children, params }: MarketingLayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dictionary, result, cookieStore] = await Promise.all([getDictionary(locale), loadShell(locale), cookies()]);
  const consentPreferences = parseConsentCookie(cookieStore.get(CONSENT_COOKIE_NAME)?.value);
  if (result.status === "error") {
    return (
      <div className="server-error-state shell-error-state" role="alert">
        <div className="marketing-container">
          <h1>粤首</h1>
          <p className="shell-error-state__slogan">{BRAND_SLOGAN}</p>
          <h2>{dictionary.marketing.errors.shellUnavailable}</h2>
          <p>{dictionary.marketing.errors.retry}</p>
        </div>
      </div>
    );
  }

  const shell = createMarketingShellViewModel(result.content, dictionary);
  const whatsappHref = shell.socialLinks.find((link) => link.label.toLowerCase() === "whatsapp" || new URL(link.href).hostname === "wa.me")?.href;
  return (
    <>
      <SeoJsonLd data={[organizationJsonLd(result.content), websiteJsonLd()]} />
      <SiteHeader model={shell} />
      {children}
      <SiteFooter model={shell} />
      <WhatsAppFloat locale={locale} href={whatsappHref} />
      <MessageFloat />
      <ConsentRuntime labels={dictionary.consent} initialPreferences={consentPreferences}>
        <div data-analytics-enabled hidden />
      </ConsentRuntime>
    </>
  );
}
