"use client";

import { useTransition } from "react";

import { reorderNavigationAction } from "@/app/admin/(dashboard)/navigation/actions";
import { reorderPageSectionsAction, savePageSectionAction } from "@/app/admin/(dashboard)/pages/[id]/actions";

import { SortableSections, type SortableSection } from "./sortable-sections";

export function PageSectionOrdering({ pageId, sections, payloads, onToggleAction = savePageSectionAction }: { pageId: string; sections: SortableSection[]; payloads?: Record<string, object>; onToggleAction?: (input: unknown) => Promise<unknown> }) {
  const [, startTransition] = useTransition();
  return <SortableSections sections={sections} onReorder={(orderedIds) => startTransition(async () => reorderPageSectionsAction({ pageId, orderedIds }))} onToggle={(id, isEnabled) => { const payload = payloads?.[id]; if (payload) startTransition(async () => { await onToggleAction({ ...payload, isEnabled }); }); }} />;
}

export function NavigationOrdering({ items }: { items: SortableSection[] }) {
  const [, startTransition] = useTransition();
  return <SortableSections sections={items} onReorder={(orderedIds) => startTransition(async () => reorderNavigationAction({ orderedIds }))} />;
}
