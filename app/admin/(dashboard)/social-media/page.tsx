import { AdminPageTitle, Card } from "@/components/admin/antd-server-bridge";
import { SocialMediaManager } from "@/components/admin/social-media-manager";
import { requireRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

import { mutateSocialMediaAction } from "./actions";

function socialLinks(value: unknown): Array<{ label: string; href: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const links = (value as Record<string, unknown>).socialLinks;
  if (!Array.isArray(links)) return [];
  return links.filter((item): item is { label: string; href: string } => Boolean(item) && typeof item === "object" && typeof (item as { label?: unknown }).label === "string" && typeof (item as { href?: unknown }).href === "string");
}

export default async function SocialMediaPage() {
  await requireRole("ADMIN");
  const setting = await prisma.siteSetting.findFirst({ where: { key: "brand", deletedAt: null } });
  if (!setting) throw new Error("未找到品牌设置");
  return (
    <main>
      <AdminPageTitle level={1}>社交媒体管理</AdminPageTitle>
      <Card>
        <SocialMediaManager initialItems={socialLinks(setting.value)} initialVersion={setting.updatedAt.toISOString()} mutate={mutateSocialMediaAction} />
      </Card>
    </main>
  );
}
