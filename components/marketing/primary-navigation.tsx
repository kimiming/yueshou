import Link from "next/link";

import { MobileNavigation } from "@/components/marketing/mobile-navigation";
import type { MarketingLinkViewModel } from "@/components/marketing/types";

type PrimaryNavigationProps = {
  label: string;
  items: MarketingLinkViewModel[];
  menuLabel: string;
  closeLabel: string;
};

export function PrimaryNavigation({ label, items, menuLabel, closeLabel }: PrimaryNavigationProps) {
  const visibleItems = items
    .filter((item) => item.enabled)
    .toSorted((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));

  return (
    <>
      <nav className="primary-navigation" aria-label={label}>
        <ul>
          {visibleItems.map((item) => (
            <li key={item.id}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <MobileNavigation label={label} items={visibleItems} menuLabel={menuLabel} closeLabel={closeLabel} />
    </>
  );
}
