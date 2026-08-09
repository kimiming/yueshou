import { SectionFrame } from "@/components/marketing/sections/section-frame";
import type { MarketingSectionViewModel } from "@/components/marketing/types";

export function GlobalReachSection({ model }: { model: MarketingSectionViewModel }) {
  return (
    <SectionFrame model={model} className="marketing-section--global">
      <div className="global-panel">
        <div className="global-panel__orbit" aria-hidden="true"><span /><span /><span /></div>
        {model.items.length > 0 ? (
          <ul>
            {model.items.map((item) => <li key={item.id}><strong>{item.title}</strong>{item.body ? <span>{item.body}</span> : null}</li>)}
          </ul>
        ) : null}
      </div>
    </SectionFrame>
  );
}
