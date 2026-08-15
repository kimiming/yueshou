import { notFound } from "next/navigation";

import { AdminPageTitle, Card } from "@/components/admin/antd-server-bridge";
import { FactoryGalleryManager } from "@/components/admin/factory-gallery-manager";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { publishFactoryGalleryAction } from "./actions";

function imageIds(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return [];
  const value = (config as Record<string, unknown>).imageIds;
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

export default async function FactoryGalleryPage() {
  await requireUser();
  const [section, assets] = await Promise.all([
    prisma.pageSection.findFirst({ where: { type: "FACTORY", deletedAt: null, page: { slug: "home", deletedAt: null } } }),
    prisma.mediaAsset.findMany({
      where: { deletedAt: null, status: { not: "ARCHIVED" }, mimeType: { startsWith: "image/" } },
      include: { translations: { where: { locale: "en" }, take: 1 } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    }),
  ]);
  if (!section) notFound();

  return (
    <main>
      <AdminPageTitle level={1}>Our Factory 画廊管理</AdminPageTitle>
      <Card>
        <FactoryGalleryManager
          initialImageIds={imageIds(section.config)}
          initialVersion={section.updatedAt.toISOString()}
          available={assets.map((asset) => ({
            id: asset.id,
            filename: asset.filename,
            alt: asset.translations[0]?.alt ?? asset.filename,
            mimeType: asset.mimeType,
            status: asset.status,
          }))}
          publish={publishFactoryGalleryAction}
        />
      </Card>
    </main>
  );
}
