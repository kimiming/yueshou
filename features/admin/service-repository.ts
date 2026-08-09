import { prisma } from "@/lib/db/prisma";
import { toDatabaseLocale } from "@/lib/i18n/config";
import { serializableRetry } from "./domain-repository";
import type { ServiceAdminRepository } from "./services";

export const prismaServiceAdminRepository: ServiceAdminRepository = {
  async saveService(input) {
    return serializableRetry(() => prisma.$transaction(async (tx) => {
      const now = new Date();
      const existing = input.id
        ? await tx.service.findFirst({ where: { id: input.id, deletedAt: null }, select: { id: true, slug: true, publishedAt: true } })
        : null;
      if (input.id && !existing) throw new Error("Service is unavailable");
      const data = {
        slug: input.slug,
        position: input.position,
        status: input.status,
        publishedAt: input.status === "PUBLISHED" ? existing?.publishedAt ?? now : existing?.publishedAt ?? null,
        deletedAt: null,
      };
      let id: string;
      if (input.id) {
        const changed = await tx.service.updateMany({
          where: { id: input.id, updatedAt: new Date(input.version!), deletedAt: null },
          data,
        });
        if (changed.count !== 1) throw new Error("Service changed by another administrator; reload and try again");
        id = input.id;
      } else {
        id = (await tx.service.create({ data })).id;
      }
      await tx.serviceTranslation.deleteMany({ where: { serviceId: id } });
      await tx.serviceTranslation.createMany({
        data: input.translations.map((translation) => ({
          serviceId: id,
          locale: toDatabaseLocale(translation.locale),
          title: translation.title,
          body: translation.body,
        })),
      });
      const record = await tx.service.findUniqueOrThrow({ where: { id }, select: { id: true, slug: true, status: true, updatedAt: true } });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: input.status === "PUBLISHED" ? "SERVICE_PUBLISHED" : input.status === "ARCHIVED" ? "SERVICE_ARCHIVED" : "SERVICE_SAVED",
          entityType: "Service",
          entityId: id,
          metadata: { slug: record.slug, status: record.status, position: input.position },
        },
      });
      return { ...record, previousSlug: existing?.slug, version: record.updatedAt.toISOString() };
    }, { isolationLevel: "Serializable" }));
  },
};
