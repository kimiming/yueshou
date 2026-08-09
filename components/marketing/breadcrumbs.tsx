import Link from "next/link";

import { SeoJsonLd } from "@/components/marketing/seo-json-ld";
import { breadcrumbJsonLd } from "@/features/seo/json-ld";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items, label }: { items: BreadcrumbItem[]; label: string }) {
  return (
    <>
      <SeoJsonLd
        data={breadcrumbJsonLd(
          items.map((item) => ({ name: item.label, url: item.href })),
        )}
      />
      <nav aria-label={label} className="breadcrumbs">
        <ol>
          {items.map((item, index) => (
            <li
              key={`${item.href ?? "current"}-${item.label}`}
              data-breadcrumb-position={index + 1}
            >
              {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
