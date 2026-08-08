"use client";

import { useId, useState } from "react";
import Link from "next/link";

import type { MarketingLinkViewModel } from "@/components/marketing/types";

type MobileNavigationProps = {
  label: string;
  items: MarketingLinkViewModel[];
};

export function MobileNavigation({ label, items }: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  return (
    <div className="mobile-navigation">
      <button
        type="button"
        className="mobile-navigation__toggle"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" className="mobile-navigation__icon">{open ? "×" : "☰"}</span>
        <span>{open ? "Close" : "Menu"}</span>
      </button>
      {open ? (
        <nav id={menuId} className="mobile-navigation__panel" aria-label={`${label} mobile`}>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <Link href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
