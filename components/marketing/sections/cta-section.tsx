import Link from "next/link";

import { localizeHref } from "@/components/marketing/link-utils";
import type { MarketingSectionViewModel } from "@/components/marketing/types";
import type { Locale } from "@/lib/i18n/config";

export function CtaSection({ model, locale }: { model: MarketingSectionViewModel; locale: Locale }) {
  if (!model.enabled) {
    return null;
  }

  return (
    <section className="cta-section" data-section={model.type} aria-labelledby={`${model.id}-title`}>
      <div className="marketing-container cta-section__inner">
        <div>
          {model.eyebrow ? <p className="section-eyebrow">{model.eyebrow}</p> : null}
          <h2 id={`${model.id}-title`}>{model.title}</h2>
          {model.body ? <p>{model.body}</p> : null}
        </div>
        {model.primaryCta ? (
          <Link className="button-link button-link--light" href={localizeHref(model.primaryCta.href, locale)}>
            {model.primaryCta.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
