import { SectionFrame } from "@/components/marketing/sections/section-frame";
import type { MarketingSectionViewModel } from "@/components/marketing/types";

export function StatsSection({ model }: { model: MarketingSectionViewModel }) {
  return (
    <SectionFrame model={model} className="marketing-section--stats">
      {model.items.length > 0 ? (
        <dl className="stats-grid">
          {model.items.map((item) => (
            <div key={item.id}>
              <dt>{item.title}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </SectionFrame>
  );
}
