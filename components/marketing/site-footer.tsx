import Link from "next/link";
import Image from "next/image";

import { CookieSettingsButton } from "@/components/consent/cookie-settings-button";
import type { MarketingShellViewModel } from "@/components/marketing/types";

type SiteFooterProps = {
  model: MarketingShellViewModel;
};

export function SiteFooter({ model }: SiteFooterProps) {
  const navigation = model.navigation
    .filter((item) => item.enabled)
    .toSorted((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));

  const links = (items: typeof navigation) => <ul className="site-footer__links">{items.map((item) => <li key={item.id}><Link href={item.href}>{item.label}</Link>{item.children?.length ? links(item.children) : null}</li>)}</ul>;
  return (
    <footer className="site-footer">
      <div className="marketing-container site-footer__grid">
        <div>
          <Link className="brand-lockup brand-lockup--footer" href={`/${model.locale}`} aria-label={model.homeLabel}>
            {model.logo ? <Image className="brand-lockup__image" src={model.logo.src} alt={model.logo.alt} width={44} height={44} /> : <span className="brand-lockup__mark" aria-hidden="true">YS</span>}
            <span className="brand-lockup__name">{model.brandName}</span>
          </Link>
          <p className="site-footer__summary">{model.footerSummary}</p>
          <p className="site-footer__research-note">{model.researchUseOnly}</p>
        </div>
        <nav aria-label={model.footerNavigationLabel}>
          <h2>{model.footerExploreLabel}</h2>
          {links(navigation)}
        </nav>
        {model.footerColumns.map((column) => (
          <nav key={column.heading} aria-label={column.heading}>
            <h2>{column.heading}</h2>
            <ul className="site-footer__links">{column.links.map((link) => <li key={`${column.heading}-${link.href}`}><Link href={link.href}>{link.label}</Link></li>)}</ul>
          </nav>
        ))}
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
          {model.socialLinks.length ? <ul className="site-footer__links" aria-label={model.socialLinksLabel}>{model.socialLinks.map((link) => <li key={link.href}><a href={link.href} rel="noopener noreferrer" target="_blank">{link.label}</a></li>)}</ul> : null}
        </div>
      </div>
      <div className="marketing-container site-footer__bottom">
        <small>{model.copyright}</small>
        <CookieSettingsButton label={model.cookieSettingsLabel} />
      </div>
    </footer>
  );
}
