import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { RichContent } from "@/components/marketing/rich-content";
import { getPageBySlug } from "@/features/content/service";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function RequestAQuotePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [page, dictionary] = await Promise.all([
    getPageBySlug(locale, "request-a-quote"),
    getDictionary(locale),
  ]);
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
        <section aria-labelledby="quote-form-heading" data-quote-form-container>
          <h2 id="quote-form-heading">{dictionary.marketing.public.quoteDetails}</h2>
          <p>{dictionary.marketing.public.gdprNotice} <Link href={`/${locale}/legal/privacy`}>{dictionary.marketing.public.privacyPolicy}</Link></p>
          <div data-quote-form-placeholder aria-labelledby="quote-form-heading" />
        </section>
      </article>
    </main>
  );
}
