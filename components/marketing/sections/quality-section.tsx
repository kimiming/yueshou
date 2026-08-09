import { SectionFrame } from "@/components/marketing/sections/section-frame";
import type { MarketingSectionViewModel } from "@/components/marketing/types";

export function QualitySection({ model }: { model: MarketingSectionViewModel }) {
  return (
    <SectionFrame model={model} className="marketing-section--quality">
      {model.items.length > 0 ? (
        <ol className="process-list">
          {model.items.map((item, index) => (
            <li key={item.id}>
              <span aria-hidden="true">{index + 1}</span>
              <div><h3>{item.title}</h3>{item.body ? <p>{item.body}</p> : null}</div>
            </li>
          ))}
        </ol>
      ) : null}
    </SectionFrame>
  );
}
