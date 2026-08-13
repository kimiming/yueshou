import Link from "next/link";
import Image from "next/image";

import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { localizeHref } from "@/components/marketing/link-utils";
import { PrimaryNavigation } from "@/components/marketing/primary-navigation";
import type { MarketingShellViewModel } from "@/components/marketing/types";

type SiteHeaderProps = {
  model: MarketingShellViewModel;
};

export function SiteHeader({ model }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__utility">
        <div className="marketing-container site-header__utility-inner">
          <span>{model.slogan}</span>
          <div className="site-header__contact">
            {model.contact.email ? <a href={`mailto:${model.contact.email}`} aria-label={`${model.emailLabel}: ${model.contact.email}`}>{model.contact.email}</a> : null}
            {model.contact.phone ? <a href={`tel:${model.contact.phone.replace(/[^+\d]/gu, "")}`} aria-label={`${model.phoneLabel}: ${model.contact.phone}`}>{model.contact.phone}</a> : null}
          </div>
          <LanguageSwitcher locale={model.locale} label={model.languageLabel} />
        </div>
      </div>
      <div className="marketing-container site-header__main">
        <Link className="brand-lockup" href={`/${model.locale}`} aria-label={model.homeLabel}>
          {model.logo ? <Image className="brand-lockup__image" src={model.logo.src} alt={model.logo.alt} width={44} height={44} /> : <span className="brand-lockup__mark" aria-hidden="true">YS</span>}
          <span className="brand-lockup__name">{model.brandName.toLocaleUpperCase("en")}</span>
        </Link>
        <PrimaryNavigation
          label={model.primaryNavigationLabel}
          items={model.navigation}
          menuLabel={model.mobileMenuLabel}
          closeLabel={model.mobileCloseLabel}
          mobileNavigationLabel={model.mobileNavigationLabel}
          searchAction={{ label: model.searchLabel, href: localizeHref("/search", model.locale) }}
        />
        <Link className="site-header__search" href={localizeHref("/search", model.locale)}>{model.searchLabel}</Link>
      </div>
    </header>
  );
}
