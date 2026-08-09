"use client";

import { Button, List, Space, Switch, Typography } from "antd";
import { sectionTypeLabels } from "./admin-labels";

export type SortableSection = { id: string; title: string; type: string; enabled: boolean };

export function SortableSections({ sections, onReorder, onToggle }: { sections: readonly SortableSection[]; onReorder?(ids: string[]): void; onToggle?(id: string, enabled: boolean): void }) {
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const ordered: SortableSection[] = Array.from(sections);
    const current = ordered[index]!;
    ordered[index] = ordered[target]!;
    ordered[target] = current;
    onReorder?.(ordered.map((section) => section.id));
  }
  return <List bordered dataSource={Array.from(sections)} locale={{ emptyText: "暂无区块。" }} renderItem={(section, index) => (
    <List.Item actions={[
      <Button key="up" size="small" aria-label={`上移 ${section.title}`} disabled={index === 0} onClick={() => move(index, -1)}>上移</Button>,
      <Button key="down" size="small" aria-label={`下移 ${section.title}`} disabled={index === sections.length - 1} onClick={() => move(index, 1)}>下移</Button>,
    ]}>
      <Space><Switch checked={section.enabled} aria-label={`启用 ${section.title}`} onChange={(enabled) => onToggle?.(section.id, enabled)} /><Typography.Text strong>{section.title}</Typography.Text><Typography.Text type="secondary">{sectionTypeLabels[section.type] ?? section.type}</Typography.Text></Space>
    </List.Item>
  )} />;
}
