import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export async function GET() {
  await requireUser();
  const assets = await prisma.mediaAsset.findMany({ where: { status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null, OR: [{ deletionJob: { is: null } }, { deletionJob: { is: { status: "COMPLETED" } } }] }, include: { translations: { where: { locale: "en" }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 100 });
  return Response.json(assets.map((asset) => ({ id: asset.id, filename: asset.filename, alt: asset.translations[0]?.alt ?? "", mimeType: asset.mimeType })), { headers: { "cache-control": "no-store" } });
}
