import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { RichContent } from "@/components/marketing/rich-content";
import { getPageBySlug, getPublishedServices } from "@/features/content/service";
import { buildMetadata } from "@/features/seo/metadata";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

type ServicesPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: ServicesPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const page = await getPageBySlug(locale, "services");
  if (!page) notFound();
  return buildMetadata({
    locale,
    path: "/services",
    title: page.seoTitle?.trim() || page.title,
    description: page.seoDescription,
  });
}

export default async function ServicesPage({ params }: ServicesPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [page, services, dictionary] = await Promise.all([
    getPageBySlug(locale, "services"),
    getPublishedServices(locale),
    getDictionary(locale),
  ]);
  if (!page) notFound();

  return (
    <main id="main-content" className="marketing-container">
      <Breadcrumbs label={dictionary.marketing.public.breadcrumbs} items={[
        { label: dictionary.navigation.home, href: `/${locale}` },
        { label: page.title },
      ]} />
      <h1>{page.title}</h1>
      <RichContent html={page.body} />
      <section aria-labelledby="service-catalog-heading">
        <h2 id="service-catalog-heading">{dictionary.navigation.services}</h2>
        <div className="content-card-grid">
          {services.map((service) => (
            <article className="content-card" key={service.id}>
              <h3>
                <Link href={`/${locale}/services/${service.slug}`}>{service.title}</Link>
              </h3>
              <RichContent html={service.body} />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
