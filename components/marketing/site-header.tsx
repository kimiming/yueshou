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
          <LanguageSwitcher locale={model.locale} label={model.languageLabel} />
        </div>
      </div>
      <div className="marketing-container site-header__main">
        <Link className="brand-lockup" href={`/${model.locale}`} aria-label={model.homeLabel}>
          {model.logo ? <Image className="brand-lockup__image" src={model.logo.src} alt={model.logo.alt} width={44} height={44} /> : <span className="brand-lockup__mark" aria-hidden="true">YS</span>}
          <span className="brand-lockup__name">{model.brandName}</span>
        </Link>
        <PrimaryNavigation
          label={model.primaryNavigationLabel}
          items={model.navigation}
          menuLabel={model.mobileMenuLabel}
          closeLabel={model.mobileCloseLabel}
          mobileNavigationLabel={model.mobileNavigationLabel}
        />
        <Link className="button-link button-link--compact" href={localizeHref("/contact", model.locale)}>
          {model.quoteLabel}
        </Link>
      </div>
    </header>
  );
}
