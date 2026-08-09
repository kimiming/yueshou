import { Typography } from "antd";
import { notFound } from "next/navigation";

import { ServiceEditorForm } from "@/components/admin/content-management-forms";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { saveServiceAction } from "../actions";

export default async function ServiceEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const service = await prisma.service.findFirst({ where: { id, deletedAt: null }, include: { translations: true } });
  if (!service) notFound();
  return <main>
    <Typography.Title level={1}>Service editor: {service.slug}</Typography.Title>
    <ServiceEditorForm
      save={saveServiceAction}
      allowArchive={user.role === "ADMIN"}
      initial={{
        id: service.id,
        version: service.updatedAt.toISOString(),
        slug: service.slug,
        position: service.position,
        status: service.status,
        translations: service.translations.map((translation) => ({
          locale: translation.locale === "zh_CN" ? "zh-CN" : translation.locale,
          title: translation.title,
          body: translation.body,
        })),
      }}
    />
  </main>;
}
