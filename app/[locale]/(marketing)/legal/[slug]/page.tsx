import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { RichContent } from "@/components/marketing/rich-content";
import { getPageBySlug } from "@/features/content/service";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export const LEGAL_PAGE_SLUGS = ["terms", "privacy", "ruo-policy", "shipping-compliance", "cookie-policy"] as const;

export default async function LegalPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !LEGAL_PAGE_SLUGS.includes(slug as (typeof LEGAL_PAGE_SLUGS)[number])) notFound();
  const [page, dictionary] = await Promise.all([getPageBySlug(locale, slug), getDictionary(locale)]);
  if (!page) notFound();

  return (
    <main id="main-content" className="marketing-container">
      <Breadcrumbs label={dictionary.marketing.public.breadcrumbs} items={[
        { label: dictionary.navigation.home, href: `/${locale}` },
        { label: page.title },
      ]} />
      <article>
        <h1>{page.title}</h1>
        <RichContent html={page.body} />
      </article>
    </main>
  );
}
