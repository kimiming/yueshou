import { NextResponse } from "next/server";

import { publishDueContent } from "@/features/admin/domain-repository";
import { verifyCronRequest } from "@/features/admin/cron-auth";
import { invalidatePublishedEntity } from "@/features/publishing/cache";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!verifyCronRequest({ secret: process.env.CRON_SECRET, timestamp: request.headers.get("x-cron-timestamp"), signature: request.headers.get("x-cron-signature") })) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const published = await publishDueContent();
  for (const article of published.articles) invalidatePublishedEntity("article", article.slug, SUPPORTED_LOCALES);
  for (const product of published.products) invalidatePublishedEntity("product", product.slug, SUPPORTED_LOCALES);
  return NextResponse.json({ articles: published.articles.length, products: published.products.length });
}
