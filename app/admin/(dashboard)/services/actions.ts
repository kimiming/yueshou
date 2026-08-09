"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prismaServiceAdminRepository } from "@/features/admin/service-repository";
import { createServiceAdminService } from "@/features/admin/services";
import { invalidatePublishedEntity } from "@/features/publishing/cache";
import { requireUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

function payload(input: unknown) {
  if (!(input instanceof FormData)) return input as Record<string, unknown>;
  return JSON.parse(String(input.get("payload") ?? "{}")) as Record<string, unknown>;
}

export async function saveServiceAction(input: unknown) {
  const actor = await requireUser();
  const body = payload(input);
  const id = typeof body.id === "string" ? body.id : undefined;
  const before = id ? await prisma.service.findUnique({ where: { id }, select: { slug: true } }) : null;
  const service = createServiceAdminService({
    repository: prismaServiceAdminRepository,
    invalidate: (slug) => invalidatePublishedEntity("service", slug, SUPPORTED_LOCALES),
  });
  const result = await service.save({ ...body, actor });
  if (before && before.slug !== result.slug) invalidatePublishedEntity("service", before.slug, SUPPORTED_LOCALES);
  revalidatePath("/admin/services");
  revalidatePath(`/admin/services/${result.id}`);
  if (!id) redirect(`/admin/services/${result.id}`);
  return result;
}
