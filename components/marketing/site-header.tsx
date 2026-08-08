import Link from "next/link";

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
        <Link className="brand-lockup" href={`/${model.locale}`} aria-label={`${model.brandName} home`}>
          <span className="brand-lockup__mark" aria-hidden="true">YS</span>
          <span className="brand-lockup__name">{model.brandName}</span>
        </Link>
        <PrimaryNavigation
          label={model.primaryNavigationLabel}
          items={model.navigation}
          menuLabel={model.mobileMenuLabel}
          closeLabel={model.mobileCloseLabel}
        />
        <Link className="button-link button-link--compact" href={localizeHref("/contact", model.locale)}>
          {model.quoteLabel}
        </Link>
      </div>
    </header>
  );
}
