import Link from "next/link";
import Image from "next/image";

import { CookieSettingsButton } from "@/components/consent/cookie-settings-button";
import type { MarketingShellViewModel } from "@/components/marketing/types";

type SiteFooterProps = {
  model: MarketingShellViewModel;
};

const socialPlatforms = [
  { label: "Facebook", href: "https://www.facebook.com", path: "M14 8.5V6.8c0-1.7 1-1.8 2.9-1.8H19V1.2c-.8-.1-2.2-.2-3.8-.2-3.7 0-6.2 2.2-6.2 6.3v1.2H5v4.3h4V23h5V12.8h4l.7-4.3H14Z" },
  { label: "Instagram", href: "https://www.instagram.com", path: "M7 1h10a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H7a6 6 0 0 1-6-6V7a6 6 0 0 1 6-6Zm0 2.2A3.8 3.8 0 0 0 3.2 7v10A3.8 3.8 0 0 0 7 20.8h10a3.8 3.8 0 0 0 3.8-3.8V7A3.8 3.8 0 0 0 17 3.2H7Zm10.4 1.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8ZM12 6.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm0 2.2a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z" },
  { label: "TikTok", href: "https://www.tiktok.com", path: "M14.2 1h4.1c.3 2.5 1.7 4 4.2 4.7v4.1a11 11 0 0 1-4.2-1.3v7.1A7.4 7.4 0 1 1 12 8.3v4.2a3.3 3.3 0 1 0 2.2 3.1V1Z" },
  { label: "X", href: "https://x.com", path: "M18.7 2H22l-7.2 8.2L23.2 22h-6.6l-5.2-6.8L5.5 22H2.2l7.7-8.8L1.8 2h6.8l4.7 6.2L18.7 2Zm-1.2 17.9h1.8L7.6 4H5.7l11.8 15.9Z" },
] as const;

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
            <span className="brand-lockup__name">{model.brandName.toLocaleUpperCase("en")}</span>
          </Link>
          <p className="site-footer__summary">{model.footerSummary}</p>
          <address className="site-footer__company-details">
            <span>Address: Room 332, 3rd Floor, No. 55 Guangcong 3rd Road, Taihe Town, Baiyun District, Guangzhou</span>
            <a href="tel:+8657583835818">Tel: 0575-83835818</a>
            <a href="https://www.yueshou-peptide.com" target="_blank" rel="noopener noreferrer">Website: www.yueshou-peptide.com</a>
          </address>
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
          <h2>Follow Us</h2>
          <ul className="site-footer__social-icons" aria-label="Social media">
            {socialPlatforms.map((platform) => (
              <li key={platform.label}>
                <a href={platform.href} target="_blank" rel="noopener noreferrer" aria-label={platform.label} title={platform.label}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={platform.path} /></svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="marketing-container site-footer__bottom">
        <small>{model.copyright}</small>
        <CookieSettingsButton label={model.cookieSettingsLabel} />
      </div>
    </footer>
  );
}
