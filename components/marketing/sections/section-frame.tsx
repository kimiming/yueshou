import type { ReactNode } from "react";

import type { MarketingSectionViewModel } from "@/components/marketing/types";

type SectionFrameProps = {
  model: MarketingSectionViewModel;
  className?: string;
  children?: ReactNode;
};

export function SectionFrame({ model, className = "", children }: SectionFrameProps) {
  if (!model.enabled) {
    return null;
  }

  return (
    <section
      className={`marketing-section ${className}`.trim()}
      data-section={model.type}
      aria-labelledby={`${model.id}-title`}
    >
      <div className="marketing-container">
        <div className="section-heading">
          {model.eyebrow ? <p className="section-eyebrow">{model.eyebrow}</p> : null}
          <h2 id={`${model.id}-title`}>{model.title}</h2>
          {model.body ? <p>{model.body}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}
