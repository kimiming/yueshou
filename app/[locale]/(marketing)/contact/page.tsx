import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { RichContent } from "@/components/marketing/rich-content";
import { getMarketingShell, getPageBySlug } from "@/features/content/service";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/features/seo/metadata";

export const dynamic = "force-dynamic";

type ContactPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: ContactPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const page = await getPageBySlug(locale, "contact");
  if (!page) notFound();
  return buildMetadata({
    locale,
    path: "/contact",
    title: page.seoTitle?.trim() || page.title,
    description: page.seoDescription,
  });
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [page, shell, dictionary] = await Promise.all([
    getPageBySlug(locale, "contact"),
    getMarketingShell(locale),
    getDictionary(locale),
  ]);
  if (!page || !shell) notFound();

  const hasContact = Boolean(shell.contact.email || shell.contact.phone || shell.contact.addressLines.length);
  return (
    <main id="main-content" className="marketing-container">
      <Breadcrumbs label={dictionary.marketing.public.breadcrumbs} items={[
        { label: dictionary.navigation.home, href: `/${locale}` },
        { label: page.title },
      ]} />
      <article>
        <h1>{page.title}</h1>
        <RichContent html={page.body} />
        {hasContact ? (
          <section aria-labelledby="contact-details-heading">
            <h2 id="contact-details-heading">{dictionary.marketing.public.contactDetails}</h2>
            <address>
              {shell.contact.addressLines.map((line) => <span key={line}>{line}<br /></span>)}
              {shell.contact.email ? <a href={`mailto:${shell.contact.email}`}>{shell.contact.email}</a> : null}
              {shell.contact.email && shell.contact.phone ? <br /> : null}
              {shell.contact.phone ? <a href={`tel:${shell.contact.phone}`}>{shell.contact.phone}</a> : null}
            </address>
          </section>
        ) : null}
      </article>
    </main>
  );
}
