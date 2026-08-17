import type { Prisma } from "@prisma/client";

import { archiveMediaAsset } from "@/features/media/service";
import { prismaMediaRepository } from "@/features/media/repository";
import { isLegalPageSlug } from "@/features/content/public-slug";
import { prisma } from "@/lib/db/prisma";
import { toDatabaseLocale } from "@/lib/i18n/config";

import { EditorValidationError, type AdminEditorRepository } from "./editors";
import { validatePagePublication } from "./publication";
import { assertExactLiveSet } from "./ordering";
import { validateSectionReferences } from "./section-references";

const sectionTypeByEditorType = {
  hero: "HERO",
  services: "SERVICES",
  about: "ABOUT",
  factory: "FACTORY",
  capabilities: "CAPABILITIES",
  quality: "QUALITY",
  "product-categories": "PRODUCT_CATEGORIES",
  "global-reach": "GLOBAL_REACH",
  stats: "STATS",
  news: "NEWS",
  cta: "CTA",
} as const;

function version(updatedAt: Date) {
  return updatedAt.toISOString();
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function writeAudit(tx: Prisma.TransactionClient, audit: { actorId: string; action: string; entityType: string; entityId?: string; metadata?: Record<string, unknown> } | undefined, entityId: string) {
  if (!audit) return;
  await tx.auditLog.create({ data: { actorId: audit.actorId, action: audit.action, entityType: audit.entityType, entityId: audit.entityId ?? entityId, metadata: audit.metadata ? asJson(audit.metadata) : undefined } });
}

function publicationRecord(page: { translations: Array<{ locale: string; title: string; body: string }>; sections: Array<{ id: string; isEnabled: boolean; type: string; config: unknown; translations: Array<{ locale: string; title: string; body: string }> }> }): {
  translations: Array<{ locale: "en" | "zh-CN" | "de" | "fr" | "es"; title: string; body: string }>;
  sections: Array<{ id: string; isEnabled: boolean; type: string; config: unknown; translations: Array<{ locale: "en" | "zh-CN" | "de" | "fr" | "es"; title: string; body: string }> }>;
} {
  const locale = (value: string) => value === "zh_CN" ? "zh-CN" : value as "en" | "de" | "fr" | "es";
  const type = (value: string) => value.toLowerCase().replaceAll("_", "-");
  return { translations: page.translations.map((item) => ({ ...item, locale: locale(item.locale) })), sections: page.sections.map((section) => ({ ...section, type: type(section.type), config: section.config, translations: section.translations.map((item) => ({ ...item, locale: locale(item.locale) })) })) };
}

async function assertNavigationParent(tx: Prisma.TransactionClient, id: string | undefined, parentId: string | null) {
  if (!parentId) return;
  if (id === parentId) throw new EditorValidationError("A navigation item cannot be its own parent");
  let candidate: string | null = parentId;
  for (let depth = 0; candidate && depth < 100; depth += 1) {
    if (candidate === id) throw new EditorValidationError("A navigation item cannot be moved below one of its descendants");
    const current: { parentId: string | null; deletedAt: Date | null } | null = await tx.navigationItem.findUnique({ where: { id: candidate }, select: { parentId: true, deletedAt: true } });
    if (!current || current.deletedAt) throw new EditorValidationError("The navigation parent no longer exists");
    candidate = current.parentId;
  }
  if (candidate) throw new EditorValidationError("Navigation hierarchy exceeds the supported depth");
}

function hasEnglishTranslation(translations: Array<{ locale: string; title: string; body?: string }>) {
  return translations.some((translation) => translation.locale === "en" && translation.title.trim() && (translation.body === undefined || translation.body.trim()));
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export function uniqueConstraintConflict(error: unknown) {
  const target = typeof error === "object" && error !== null && "meta" in error && typeof error.meta === "object" && error.meta !== null && "target" in error.meta ? String(error.meta.target) : "";
  if (target.includes("slug")) return new EditorValidationError("This slug is already in use");
  if (target.includes("locale")) return new EditorValidationError("A translation already exists for this locale");
  if (target.includes("domain")) return new EditorValidationError("This domain is already in use");
  return new EditorValidationError("This content conflicts with an existing record");
}

function brandMediaIds(value: Record<string, unknown>) {
  return [...new Set([value.logoMediaId, value.faviconMediaId].filter((id): id is string => typeof id === "string"))];
}

function sectionMediaIds(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return [];
  const value = config as Record<string, unknown>;
  const imageIds = Array.isArray(value.imageIds)
    ? value.imageIds.filter((id): id is string => typeof id === "string")
    : [];
  return typeof value.imageId === "string" ? [value.imageId, ...imageIds] : imageIds;
}

async function assertUsableReferencedMedia(tx: Prisma.TransactionClient, mediaIds: string[]) {
  const uniqueIds = [...new Set(mediaIds)];
  if (!uniqueIds.length) return;
  const count = await tx.mediaAsset.count({ where: { id: { in: uniqueIds }, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null, OR: [{ deletionJob: { is: null } }, { deletionJob: { is: { status: "COMPLETED" } } }] } });
  if (count !== uniqueIds.length) throw new EditorValidationError("Referenced media must be published and not queued for deletion");
}

async function assertUsableBrandMedia(tx: Prisma.TransactionClient, mediaIds: string[]) {
  if (!mediaIds.length) return;
  const count = await tx.mediaAsset.count({ where: { id: { in: mediaIds }, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null, OR: [{ deletionJob: { is: null } }, { deletionJob: { is: { status: "COMPLETED" } } }] } });
  if (count !== mediaIds.length) throw new EditorValidationError("Brand media must be published, public, and available");
}

async function replaceTranslations(
  tx: Prisma.TransactionClient,
  entity: "siteSetting" | "navigationItem" | "page" | "pageSection" | "mediaAsset",
  id: string,
  translations: Array<{ locale: "en" | "zh-CN" | "de" | "fr" | "es"; title: string; body?: string; alt?: string; seoTitle?: string; seoDescription?: string }>,
) {
  if (entity === "siteSetting") {
    await tx.siteSettingTranslation.deleteMany({ where: { siteSettingId: id } });
    await tx.siteSettingTranslation.createMany({ data: translations.map((item) => ({ siteSettingId: id, locale: toDatabaseLocale(item.locale), title: item.title, body: item.body ?? "" })) });
  } else if (entity === "navigationItem") {
    await tx.navigationItemTranslation.deleteMany({ where: { navigationItemId: id } });
    await tx.navigationItemTranslation.createMany({ data: translations.map((item) => ({ navigationItemId: id, locale: toDatabaseLocale(item.locale), title: item.title })) });
  } else if (entity === "page") {
    await tx.pageTranslation.deleteMany({ where: { pageId: id } });
    await tx.pageTranslation.createMany({ data: translations.map((item) => ({ pageId: id, locale: toDatabaseLocale(item.locale), title: item.title, body: item.body ?? "", seoTitle: item.seoTitle, seoDescription: item.seoDescription })) });
  } else if (entity === "pageSection") {
    await tx.pageSectionTranslation.deleteMany({ where: { pageSectionId: id } });
    await tx.pageSectionTranslation.createMany({ data: translations.map((item) => ({ pageSectionId: id, locale: toDatabaseLocale(item.locale), title: item.title, body: item.body ?? "" })) });
  } else {
    await tx.mediaAssetTranslation.deleteMany({ where: { mediaAssetId: id } });
    await tx.mediaAssetTranslation.createMany({ data: translations.map((item) => ({ mediaAssetId: id, locale: toDatabaseLocale(item.locale), title: item.title, body: item.body ?? "", alt: item.alt ?? "" })) });
  }
}

export const prismaAdminEditorRepository: AdminEditorRepository = {
  auditsMutations: true,
  validatesPublicationAtomically: true,
  async validateBrandMedia(mediaIds) {
    const uniqueIds = [...new Set(mediaIds)];
    const count = await prisma.mediaAsset.count({ where: { id: { in: uniqueIds }, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null, OR: [{ deletionJob: { is: null } }, { deletionJob: { is: { status: "COMPLETED" } } }] } });
    return count === uniqueIds.length;
  },
  async saveSiteSetting(input) {
    return prisma.$transaction(async (tx) => {
      await assertUsableBrandMedia(tx, brandMediaIds(input.value));
      if (input.version === null) {
        try {
          const created = await tx.siteSetting.create({ data: { key: input.key, value: asJson(input.value), status: input.status, publishedAt: input.status === "PUBLISHED" ? new Date() : null } });
          await replaceTranslations(tx, "siteSetting", created.id, input.translations);
          await writeAudit(tx, input.audit, created.id);
          return { id: created.id, version: version(created.updatedAt) };
        } catch (error) {
          if (isUniqueConstraintError(error)) throw uniqueConstraintConflict(error);
          throw error;
        }
      }
      const updated = await tx.siteSetting.updateMany({
        where: { key: input.key, updatedAt: new Date(input.version), deletedAt: null },
        data: { value: asJson(input.value), status: input.status, publishedAt: input.status === "PUBLISHED" ? new Date() : null },
      });
      if (updated.count !== 1) return null;
      const record = await tx.siteSetting.findUniqueOrThrow({ where: { key: input.key }, select: { id: true, updatedAt: true } });
      await replaceTranslations(tx, "siteSetting", record.id, input.translations);
      await writeAudit(tx, input.audit, record.id);
      return { id: record.id, version: version(record.updatedAt) };
    }, { isolationLevel: "Serializable" }).catch((error) => {
      if (isUniqueConstraintError(error)) throw uniqueConstraintConflict(error);
      throw error;
    });
  },

  async saveNavigationItem(input) {
    return prisma.$transaction(async (tx) => {
      await assertNavigationParent(tx, input.id, input.parentId);
      if (!input.id) {
        try {
          const created = await tx.navigationItem.create({ data: { slug: input.slug, href: input.href, parentId: input.parentId, position: input.position, isVisible: input.isVisible, status: input.status, publishedAt: input.status === "PUBLISHED" ? new Date() : null } });
          await replaceTranslations(tx, "navigationItem", created.id, input.translations);
          await writeAudit(tx, input.audit, created.id);
          return { id: created.id, version: version(created.updatedAt) };
        } catch (error) {
          if (isUniqueConstraintError(error)) throw uniqueConstraintConflict(error);
          throw error;
        }
      }
      const updated = await tx.navigationItem.updateMany({
        where: { id: input.id, updatedAt: new Date(input.version ?? ""), deletedAt: null },
        data: { slug: input.slug, href: input.href, parentId: input.parentId, position: input.position, isVisible: input.isVisible, status: input.status, publishedAt: input.status === "PUBLISHED" ? new Date() : null },
      });
      if (updated.count !== 1) return null;
      const record = await tx.navigationItem.findUniqueOrThrow({ where: { id: input.id }, select: { id: true, updatedAt: true } });
      await replaceTranslations(tx, "navigationItem", record.id, input.translations);
      await writeAudit(tx, input.audit, record.id);
      return { id: record.id, version: version(record.updatedAt) };
    }, { isolationLevel: "Serializable" }).catch((error) => {
      if (isUniqueConstraintError(error)) throw uniqueConstraintConflict(error);
      throw error;
    });
  },

  async isNavigationDescendant(id, proposedParentId) {
    let candidate: string | null = proposedParentId;
    for (let depth = 0; candidate && depth < 100; depth += 1) {
      if (candidate === id) return true;
      const current: { parentId: string | null } | null = await prisma.navigationItem.findUnique({ where: { id: candidate }, select: { parentId: true } });
      candidate = current?.parentId ?? null;
    }
    return Boolean(candidate);
  },

  async reorderNavigation({ orderedIds, audit }) {
    await prisma.$transaction(async (tx) => {
      const records = await tx.navigationItem.findMany({ where: { id: { in: orderedIds }, deletedAt: null }, select: { id: true, parentId: true } });
      const parentIds = new Set(records.map((record) => record.parentId));
      const siblings = parentIds.size === 1 ? await tx.navigationItem.findMany({ where: { parentId: records[0]?.parentId ?? null, deletedAt: null }, select: { id: true } }) : [];
      if (records.length !== orderedIds.length || parentIds.size !== 1) throw new EditorValidationError("Navigation collection changed; reload and try again");
      assertExactLiveSet(orderedIds, siblings.map((record) => record.id), "Navigation");
      await tx.navigationItem.updateMany({ where: { id: { in: orderedIds } }, data: { position: { increment: 1_000_000 } } });
      await Promise.all(orderedIds.map((id, position) => tx.navigationItem.update({ where: { id }, data: { position } })));
      await writeAudit(tx, audit, "navigation");
    }, { isolationLevel: "Serializable" });
  },

  async getPageTranslations(pageId) {
    const translations = await prisma.pageTranslation.findMany({ where: { pageId }, select: { locale: true, title: true, body: true } });
    return translations.map((item) => ({ locale: item.locale === "zh_CN" ? "zh-CN" : item.locale, title: item.title, body: item.body }));
  },

  async isPagePublished(pageId) {
    const page = await prisma.page.findUnique({ where: { id: pageId }, select: { status: true, deletedAt: true } });
    return page?.status === "PUBLISHED" && page.deletedAt === null;
  },

  async getPageForPublication(pageId) {
    const page = await prisma.page.findUnique({ where: { id: pageId }, select: { translations: { select: { locale: true, title: true, body: true } }, sections: { where: { deletedAt: null }, select: { id: true, isEnabled: true, type: true, config: true, translations: { select: { locale: true, title: true, body: true } } } } } });
    if (!page) return null;
    return publicationRecord(page);
  },

  async savePage(input) {
    return prisma.$transaction(async (tx) => {
      if (!input.id) {
        try {
          const created = await tx.page.create({ data: { slug: input.slug, legalReviewStatus: isLegalPageSlug(input.slug) ? "PENDING" : "NOT_REQUIRED" } });
          await replaceTranslations(tx, "page", created.id, input.translations);
          const record = await tx.page.findUniqueOrThrow({ where: { id: created.id }, select: { id: true, slug: true, updatedAt: true, contentRevision: true } });
          await writeAudit(tx, input.audit, created.id);
          return { id: record.id, slug: record.slug, version: version(record.updatedAt), contentRevision: record.contentRevision };
        } catch (error) {
          if (isUniqueConstraintError(error)) throw uniqueConstraintConflict(error);
          throw error;
        }
      }
      const updated = await tx.page.updateMany({ where: { id: input.id, updatedAt: new Date(input.version ?? ""), deletedAt: null }, data: { slug: input.slug } });
      if (updated.count !== 1) return null;
      const current = await tx.page.findUniqueOrThrow({ where: { id: input.id }, select: { id: true, status: true } });
      await replaceTranslations(tx, "page", current.id, input.translations);
      if (current.status === "PUBLISHED") {
        const publication = await tx.page.findUniqueOrThrow({ where: { id: current.id }, select: { translations: { select: { locale: true, title: true, body: true } }, sections: { where: { deletedAt: null }, select: { id: true, isEnabled: true, type: true, config: true, translations: { select: { locale: true, title: true, body: true } } } } } });
        validatePagePublication(publicationRecord(publication));
      }
      const record = await tx.page.findUniqueOrThrow({ where: { id: current.id }, select: { id: true, slug: true, updatedAt: true, contentRevision: true } });
      await writeAudit(tx, input.audit, record.id);
      return { id: record.id, slug: record.slug, version: version(record.updatedAt), contentRevision: record.contentRevision };
    }, { isolationLevel: "Serializable" }).catch((error) => {
      if (isUniqueConstraintError(error)) throw uniqueConstraintConflict(error);
      throw error;
    });
  },

  async savePageAndChangeStatus(input) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const updated = await tx.page.updateMany({ where: { id: input.id!, updatedAt: new Date(input.version!), deletedAt: null }, data: { slug: input.slug } });
      if (updated.count !== 1) return null;
      const current = await tx.page.findUniqueOrThrow({ where: { id: input.id! }, select: { id: true, slug: true, updatedAt: true, translations: { select: { locale: true, title: true, body: true } }, sections: { where: { deletedAt: null }, select: { id: true, isEnabled: true, type: true, config: true, translations: { select: { locale: true, title: true, body: true } } } } } });
      await replaceTranslations(tx, "page", current.id, input.translations);
      const publication = await tx.page.findUniqueOrThrow({ where: { id: current.id }, select: { translations: { select: { locale: true, title: true, body: true } }, sections: { where: { deletedAt: null }, select: { id: true, isEnabled: true, type: true, config: true, translations: { select: { locale: true, title: true, body: true } } } } } });
      if (input.status === "PUBLISHED") validatePagePublication(publicationRecord(publication));
      const page = await tx.page.update({ where: { id: current.id }, data: { status: input.status, publishedAt: input.status === "PUBLISHED" ? now : null }, select: { id: true, slug: true, publishedAt: true, updatedAt: true } });
      if (input.status === "PUBLISHED") await tx.pageSection.updateMany({ where: { pageId: page.id, deletedAt: null, isEnabled: true }, data: { status: "PUBLISHED", publishedAt: now } });
      await writeAudit(tx, input.audit, page.id);
      await writeAudit(tx, input.statusAudit, page.id);
      return { id: page.id, slug: page.slug, publishedAt: page.publishedAt, version: version(page.updatedAt) };
    }, { isolationLevel: "Serializable" }).catch((error) => { if (isUniqueConstraintError(error)) throw uniqueConstraintConflict(error); throw error; });
  },

  async approveLegalPage({ pageId, version: expectedVersion, expectedRevision, actorId, audit }) {
    const reviewedAt = new Date();
    return prisma.$transaction(async (tx) => {
      const current = await tx.page.findFirst({
        where: {
          id: pageId,
          updatedAt: new Date(expectedVersion),
          contentRevision: expectedRevision,
          status: "DRAFT",
          legalReviewStatus: "PENDING",
          deletedAt: null,
        },
        select: {
          id: true,
          slug: true,
          translations: { select: { locale: true, title: true, body: true } },
          sections: { where: { deletedAt: null }, select: { id: true, isEnabled: true, type: true, config: true, translations: { select: { locale: true, title: true, body: true } } } },
        },
      });
      if (!current) return null;
      validatePagePublication(publicationRecord(current));
      const approved = await tx.page.updateMany({
        where: {
          id: pageId,
          updatedAt: new Date(expectedVersion),
          contentRevision: expectedRevision,
          status: "DRAFT",
          legalReviewStatus: "PENDING",
          deletedAt: null,
        },
        data: {
          legalReviewStatus: "APPROVED",
          legalReviewedAt: reviewedAt,
          legalReviewedRevision: expectedRevision,
          legalReviewedById: actorId,
        },
      });
      if (approved.count !== 1) return null;
      const record = await tx.page.findUniqueOrThrow({
        where: { id: pageId },
        select: { id: true, slug: true, updatedAt: true, contentRevision: true, legalReviewedRevision: true },
      });
      await writeAudit(tx, audit, pageId);
      return {
        id: record.id,
        slug: record.slug,
        version: version(record.updatedAt),
        contentRevision: record.contentRevision,
        legalReviewedRevision: record.legalReviewedRevision!,
      };
    }, { isolationLevel: "Serializable" });
  },

  async savePageSection(input) {
    return prisma.$transaction(async (tx) => {
      await assertUsableReferencedMedia(tx, sectionMediaIds(input.section.config));
      const page = await tx.page.findUnique({ where: { id: input.pageId }, select: { status: true, deletedAt: true } });
      if (!page || page.deletedAt) return null;
      await validateSectionReferences({
        countServices: (ids, requirePublished) => tx.service.count({ where: { id: { in: ids }, deletedAt: null, status: requirePublished ? "PUBLISHED" : { not: "ARCHIVED" } } }),
        countProductCategories: (ids, requirePublished) => tx.productCategory.count({ where: { id: { in: ids }, deletedAt: null, status: requirePublished ? "PUBLISHED" : { not: "ARCHIVED" } } }),
        countHomepageItems: (ids, requirePublished) => tx.siteSetting.count({ where: { id: { in: ids }, key: { not: "brand" }, deletedAt: null, status: requirePublished ? "PUBLISHED" : { not: "ARCHIVED" } } }),
      }, input.section.config, page.status === "PUBLISHED");
      if (page.status === "PUBLISHED" && input.isEnabled && !hasEnglishTranslation(input.translations)) {
        throw new EditorValidationError("English translation is required before enabling a published page section");
      }
      const data = { pageId: input.pageId, type: sectionTypeByEditorType[input.section.type], config: asJson(input.section.config), position: input.position, isEnabled: input.isEnabled };
      if (!input.id) {
        const created = await tx.pageSection.create({ data });
        await replaceTranslations(tx, "pageSection", created.id, input.translations);
        await writeAudit(tx, input.audit, created.id);
        return { id: created.id, version: version(created.updatedAt) };
      }
      const updated = await tx.pageSection.updateMany({ where: { id: input.id, updatedAt: new Date(input.version ?? ""), deletedAt: null }, data });
      if (updated.count !== 1) return null;
      const record = await tx.pageSection.findUniqueOrThrow({ where: { id: input.id }, select: { id: true, updatedAt: true } });
      await replaceTranslations(tx, "pageSection", record.id, input.translations);
      await writeAudit(tx, input.audit, record.id);
      return { id: record.id, version: version(record.updatedAt) };
    }, { isolationLevel: "Serializable" }).catch((error) => {
      if (isUniqueConstraintError(error)) throw uniqueConstraintConflict(error);
      throw error;
    });
  },

  async reorderPageSections({ pageId, orderedIds, audit }) {
    await prisma.$transaction(async (tx) => {
      const records = await tx.pageSection.findMany({ where: { pageId, id: { in: orderedIds }, deletedAt: null }, select: { id: true } });
      const siblings = await tx.pageSection.findMany({ where: { pageId, deletedAt: null }, select: { id: true } });
      if (records.length !== orderedIds.length) throw new EditorValidationError("Section collection changed; reload and try again");
      assertExactLiveSet(orderedIds, siblings.map((record) => record.id), "Section");
      await tx.pageSection.updateMany({ where: { pageId, id: { in: orderedIds }, deletedAt: null }, data: { position: { increment: 1_000_000 } } });
      await Promise.all(orderedIds.map((id, position) => tx.pageSection.update({ where: { id, pageId }, data: { position } })));
      await writeAudit(tx, audit, pageId);
    }, { isolationLevel: "Serializable" });
  },

  async changePageStatus({ pageId, version: expectedVersion, status, audit }) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const current = await tx.page.findUnique({ where: { id: pageId }, select: { updatedAt: true, deletedAt: true, translations: { select: { locale: true, title: true, body: true } }, sections: { where: { deletedAt: null }, select: { id: true, isEnabled: true, type: true, config: true, translations: { select: { locale: true, title: true, body: true } } } } } });
      if (!current || current.deletedAt || current.updatedAt.getTime() !== new Date(expectedVersion).getTime()) return null;
      if (status === "PUBLISHED") validatePagePublication(publicationRecord(current));
      const updated = await tx.page.updateMany({ where: { id: pageId, updatedAt: new Date(expectedVersion), deletedAt: null }, data: { status, publishedAt: status === "PUBLISHED" ? now : null } });
      if (updated.count !== 1) return null;
      const page = await tx.page.findUniqueOrThrow({ where: { id: pageId }, select: { id: true, slug: true, publishedAt: true } });
      if (status === "PUBLISHED") await tx.pageSection.updateMany({ where: { pageId, deletedAt: null, isEnabled: true }, data: { status: "PUBLISHED", publishedAt: now } });
      await writeAudit(tx, audit, page.id);
      return page;
    }, { isolationLevel: "Serializable" });
  },

  async saveMediaMetadata(input) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.mediaAsset.updateMany({ where: { id: input.id, updatedAt: new Date(input.version ?? ""), deletedAt: null }, data: { updatedAt: new Date() } });
      if (updated.count !== 1) return null;
      const record = await tx.mediaAsset.findUniqueOrThrow({ where: { id: input.id }, select: { id: true, updatedAt: true } });
      await replaceTranslations(tx, "mediaAsset", record.id, input.translations);
      await writeAudit(tx, input.audit, record.id);
      return { id: record.id, version: version(record.updatedAt) };
    });
  },

  async getMediaTranslations(mediaAssetId) {
    const translations = await prisma.mediaAssetTranslation.findMany({ where: { mediaAssetId }, select: { locale: true, alt: true } });
    return translations.map((translation) => ({ locale: (translation.locale === "zh_CN" ? "zh-CN" : translation.locale) as "en" | "zh-CN" | "de" | "fr" | "es", alt: translation.alt }));
  },

  async publishMedia({ mediaAssetId, version: expectedVersion, actorId }) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.mediaAsset.updateMany({ where: { id: mediaAssetId, updatedAt: new Date(expectedVersion), deletedAt: null }, data: { status: "PUBLISHED", publishedAt: new Date() } });
      if (updated.count !== 1) return null;
      await tx.auditLog.create({ data: { actorId, action: "PUBLISH", entityType: "MediaAsset", entityId: mediaAssetId } });
      return { id: mediaAssetId };
    });
  },

  archiveMedia({ actor, mediaAssetId }) {
    return archiveMediaAsset({ repository: prismaMediaRepository }, { actor, mediaAssetId });
  },

  async createAuditLog(input) {
    await prisma.auditLog.create({ data: { ...input, metadata: input.metadata ? asJson(input.metadata) : undefined } });
  },
};
