"use client";

import { Card, Col, List, Row, Statistic, Typography } from "antd";

type DashboardViewProps = {
  draftContent: number;
  missingTranslations: number;
  openInquiries: number;
  recentAuditEntries: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
  }>;
};

export function DashboardView({
  draftContent,
  missingTranslations,
  openInquiries,
  recentAuditEntries,
}: DashboardViewProps) {
  return (
    <main>
      <Typography.Title level={1}>仪表盘</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Card><Statistic title="草稿内容" value={draftContent} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="缺少翻译" value={missingTranslations} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="待处理询盘" value={openInquiries} /></Card></Col>
        <Col xs={24}>
          <Card title="最近审计记录">
            <List
              locale={{ emptyText: "暂无审计记录。" }}
              dataSource={recentAuditEntries}
              renderItem={(entry) => (
                <List.Item>
                  <List.Item.Meta title={entry.action} description={`${entry.entityType} · ${entry.createdAt}`} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </main>
  );
}
