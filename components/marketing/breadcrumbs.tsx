import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items, label }: { items: BreadcrumbItem[]; label: string }) {
  return (
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
  );
}
