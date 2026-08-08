"use client";

import { useTransition } from "react";

import { reorderNavigationAction } from "@/app/admin/(dashboard)/navigation/actions";
import { reorderPageSectionsAction } from "@/app/admin/(dashboard)/pages/[id]/actions";

import { SortableSections, type SortableSection } from "./sortable-sections";

export function PageSectionOrdering({ pageId, sections }: { pageId: string; sections: SortableSection[] }) {
  const [, startTransition] = useTransition();
  return <SortableSections sections={sections} onReorder={(orderedIds) => startTransition(async () => reorderPageSectionsAction({ pageId, orderedIds }))} />;
}

export function NavigationOrdering({ items }: { items: SortableSection[] }) {
  const [, startTransition] = useTransition();
  return <SortableSections sections={items} onReorder={(orderedIds) => startTransition(async () => reorderNavigationAction({ orderedIds }))} />;
}
