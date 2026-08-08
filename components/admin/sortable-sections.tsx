"use client";

import { Button, List, Space, Switch, Typography } from "antd";

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
  return <List bordered dataSource={Array.from(sections)} locale={{ emptyText: "No sections yet." }} renderItem={(section, index) => (
    <List.Item actions={[
      <Button key="up" size="small" aria-label={`Move ${section.title} up`} disabled={index === 0} onClick={() => move(index, -1)}>Up</Button>,
      <Button key="down" size="small" aria-label={`Move ${section.title} down`} disabled={index === sections.length - 1} onClick={() => move(index, 1)}>Down</Button>,
    ]}>
      <Space><Switch checked={section.enabled} aria-label={`Enable ${section.title}`} onChange={(enabled) => onToggle?.(section.id, enabled)} /><Typography.Text strong>{section.title}</Typography.Text><Typography.Text type="secondary">{section.type}</Typography.Text></Space>
    </List.Item>
  )} />;
}
