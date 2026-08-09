import { Card, Col, List, Row, Statistic, Typography } from "antd";

import { getAdminDashboard } from "@/features/admin/dashboard";
import { prismaAdminDashboardRepository } from "@/features/admin/repository";
import { requireUser } from "@/lib/auth/permissions";

export default async function AdminDashboardPage() {
  await requireUser();
  const dashboard = await getAdminDashboard(prismaAdminDashboardRepository);

  return (
    <main>
      <Typography.Title level={1}>Dashboard</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Card><Statistic title="Draft content" value={dashboard.draftContent} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="Missing translations" value={dashboard.missingTranslations} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="Open inquiries" value={dashboard.openInquiries} /></Card></Col>
        <Col xs={24}>
          <Card title="Recent audit entries">
            <List
              locale={{ emptyText: "No audit entries recorded." }}
              dataSource={dashboard.recentAuditEntries}
              renderItem={(entry) => (
                <List.Item>
                  <List.Item.Meta title={entry.action} description={`${entry.entityType} · ${entry.createdAt.toISOString()}`} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </main>
  );
}
