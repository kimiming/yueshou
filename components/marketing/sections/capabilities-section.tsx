import { SectionFrame } from "@/components/marketing/sections/section-frame";
import type { MarketingSectionViewModel } from "@/components/marketing/types";

export function CapabilitiesSection({ model }: { model: MarketingSectionViewModel }) {
  return (
    <SectionFrame model={model} className="marketing-section--tinted">
      {model.items.length > 0 ? (
        <div className="capability-grid">
          {model.items.map((item) => (
            <article key={item.id}>
              <span className="capability-grid__dot" aria-hidden="true" />
              <h3>{item.title}</h3>
              {item.body ? <p>{item.body}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </SectionFrame>
  );
}
