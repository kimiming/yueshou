import Link from "next/link";

import type { MarketingShellViewModel } from "@/components/marketing/types";

type SiteFooterProps = {
  model: MarketingShellViewModel;
};

export function SiteFooter({ model }: SiteFooterProps) {
  const navigation = model.navigation
    .filter((item) => item.enabled)
    .toSorted((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));

  return (
    <footer className="site-footer">
      <div className="marketing-container site-footer__grid">
        <div>
          <Link className="brand-lockup brand-lockup--footer" href={`/${model.locale}`}>
            <span className="brand-lockup__mark" aria-hidden="true">YS</span>
            <span className="brand-lockup__name">{model.brandName}</span>
          </Link>
          <p className="site-footer__summary">{model.footerSummary}</p>
          <p className="site-footer__research-note">{model.researchUseOnly}</p>
        </div>
        <nav aria-label={model.footerNavigationLabel}>
          <h2>{model.footerExploreLabel}</h2>
          <ul className="site-footer__links">
            {navigation.map((item) => (
              <li key={item.id}><Link href={item.href}>{item.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div>
          <h2>{model.footerContactLabel}</h2>
          <address>
            {model.contact.addressLines.map((line) => <span key={line}>{line}</span>)}
            {model.contact.email ? <a href={`mailto:${model.contact.email}`}>{model.contact.email}</a> : null}
            {model.contact.phone ? <a href={`tel:${model.contact.phone}`}>{model.contact.phone}</a> : null}
            {!model.contact.email && !model.contact.phone && model.contact.addressLines.length === 0 ? (
              <Link href={`/${model.locale}/contact`}>{model.contactTeamLabel}</Link>
            ) : null}
          </address>
        </div>
      </div>
      <div className="marketing-container site-footer__bottom">
        <small>{model.copyright}</small>
      </div>
    </footer>
  );
}
