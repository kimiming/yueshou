import type { ReactNode } from "react";
import { ConfigProvider } from "antd";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { createMarketingShellViewModel } from "@/components/marketing/view-models";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";

type MarketingLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function MarketingLayout({ children, params }: MarketingLayoutProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const shell = createMarketingShellViewModel(locale, dictionary);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1261a6",
          colorInfo: "#1261a6",
          colorSuccess: "#078b8c",
          colorText: "#10243e",
          colorBgBase: "#ffffff",
          borderRadius: 6,
          fontFamily: "Arial, Helvetica, sans-serif",
        },
      }}
    >
      <SiteHeader model={shell} currentPath={`/${locale}`} />
      {children}
      <SiteFooter model={shell} />
    </ConfigProvider>
  );
}
