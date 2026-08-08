import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { isLocale, SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMarketingShell } from "@/features/content/service";
import "../globals.css";

const fallbackMetadata: Metadata = {
  title: "粤首",
  description: "Precision Peptide Synthesis for Global Scientific Research",
};
function publicMediaUrl(storageKey: string) {
  return storageKey.startsWith("/") ? storageKey : `/${storageKey}`;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return fallbackMetadata;
  try {
    const shell = await getMarketingShell(locale);
    const seo = shell?.defaultSeo;
    return {
      title: seo?.title ?? fallbackMetadata.title,
      description: seo?.description ?? fallbackMetadata.description,
      keywords: seo?.keywords,
      icons: shell?.favicon ? { icon: publicMediaUrl(shell.favicon.storageKey) } : undefined,
    };
  } catch {
    return fallbackMetadata;
  }
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);

  return (
    <html lang={locale}>
      <body data-site-name={dictionary.site.name}>
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}
