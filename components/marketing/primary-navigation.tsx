import Link from "next/link";

import { MobileNavigation } from "@/components/marketing/mobile-navigation";
import type { MarketingLinkViewModel } from "@/components/marketing/types";

type PrimaryNavigationProps = {
  label: string;
  items: MarketingLinkViewModel[];
  menuLabel: string;
  closeLabel: string;
  mobileNavigationLabel: string;
  searchAction: { label: string; href: string };
};

export function PrimaryNavigation({
  label,
  items,
  menuLabel,
  closeLabel,
  mobileNavigationLabel,
  searchAction,
}: PrimaryNavigationProps) {
  const visibleItems = items
    .filter((item) => item.enabled)
    .toSorted((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));

  const navigationList = (entries: MarketingLinkViewModel[]) => <ul>{entries.map((item) => <li key={item.id}><Link href={item.href}>{item.label}</Link>{item.children?.length ? navigationList(item.children) : null}</li>)}</ul>;
  return (
    <>
      <nav className="primary-navigation" aria-label={label}>
        {navigationList(visibleItems)}
      </nav>
      <MobileNavigation
        label={mobileNavigationLabel}
        items={visibleItems}
        menuLabel={menuLabel}
        closeLabel={closeLabel}
        searchAction={searchAction}
      />
    </>
  );
}
