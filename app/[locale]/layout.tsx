import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { isLocale, SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import "../globals.css";

export const metadata: Metadata = {
  title: "粤首",
  description: "Precision Peptide Synthesis for Global Scientific Research",
};

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
