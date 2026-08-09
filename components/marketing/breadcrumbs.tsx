import { SeoJsonLd } from "@/components/marketing/seo-json-ld";
import { breadcrumbJsonLd } from "@/features/seo/json-ld";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[]; label: string }) {
  return <SeoJsonLd data={breadcrumbJsonLd(items.map((item) => ({ name: item.label, url: item.href })))} />;
}
