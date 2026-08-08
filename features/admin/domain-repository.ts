import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { toDatabaseLocale } from "@/lib/i18n/config";
import type { InquiryAdminRepository } from "./inquiries";
import { inquiryWhere } from "@/features/inquiries/filters";
import type { NewsAdminInput, NewsAdminRepository } from "./news";
import type { ProductAdminInput, ProductAdminRepository } from "./products";
import type { UserAdminRepository } from "./users";

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const audit = (tx: Prisma.TransactionClient, actorId: string | null, action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) => tx.auditLog.create({ data: { actorId: actorId ?? undefined, action, entityType, entityId, metadata: metadata ? json(metadata) : undefined } });

async function assertUsableMedia(tx: Prisma.TransactionClient, ids: readonly string[]) {
  const unique = [...new Set(ids)]; if (!unique.length) return;
  const count = await tx.mediaAsset.count({ where: { id: { in: unique }, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null, OR: [{ deletionJob: { is: null } }, { deletionJob: { is: { status: "COMPLETED" } } }] } });
  if (count !== unique.length) throw new Error("Referenced media must be published, public, and available");
}
async function assertActiveCategory(tx: Prisma.TransactionClient, kind: "product" | "article", id: string, requirePublished = false) {
  const status = requirePublished ? "PUBLISHED" as const : { not: "ARCHIVED" as const };
  const count = kind === "product" ? await tx.productCategory.count({ where: { id, deletedAt: null, status } }) : await tx.articleCategory.count({ where: { id, deletedAt: null, status } });
  if (count !== 1) throw new Error("Referenced category must be active and available");
}
async function assertActiveTags(tx: Prisma.TransactionClient, ids: readonly string[]) {
  const unique = [...new Set(ids)]; if (!unique.length) return;
  const count = await tx.tag.count({ where: { id: { in: unique }, deletedAt: null } });
  if (count !== unique.length) throw new Error("Referenced tags must be active and available");
}

export const prismaProductAdminRepository: ProductAdminRepository = {
  async saveProduct(input: ProductAdminInput & { actorId: string }) {
    return serializableRetry(() => prisma.$transaction(async (tx) => {
      await assertActiveCategory(tx, "product", input.categoryId, input.status === "PUBLISHED");
      await assertUsableMedia(tx, input.mediaIds);
      const existing = input.id ? await tx.product.findUniqueOrThrow({ where: { id: input.id }, select: { publishedAt: true } }) : null;
      const publication = input.status === "PUBLISHED" ? { status: input.status, scheduledAt: input.scheduledAt ?? null, publishedAt: existing?.publishedAt ?? new Date() } : { status: input.status, scheduledAt: input.scheduledAt ?? null, publishedAt: existing?.publishedAt ?? null };
      const payload = { categoryId: input.categoryId, slug: input.slug, casNumber: input.casNumber ?? null, sequence: input.sequence ?? null, specifications: input.specifications ? json(input.specifications) : undefined, ...publication };
      let record;
      if (input.id) { if (!input.version) throw new Error("content_conflict"); const updated = await tx.product.updateMany({ where: { id: input.id, updatedAt: new Date(input.version) }, data: payload }); if (updated.count !== 1) throw new Error("content_conflict"); record = await tx.product.update({ where: { id: input.id }, data: { media: { set: input.mediaIds.map((id) => ({ id })) } } }); } else record = await tx.product.create({ data: { ...payload, media: { connect: input.mediaIds.map((id) => ({ id })) } } });
      await tx.productTranslation.deleteMany({ where: { productId: record.id } });
      await tx.productTranslation.createMany({ data: input.translations.map((item) => ({ productId: record.id, locale: toDatabaseLocale(item.locale), title: item.title, body: item.body })) });
      await audit(tx, input.actorId, input.status === "PUBLISHED" ? "PRODUCT_PUBLISHED" : "PRODUCT_SAVED", "Product", record.id, { slug: record.slug, status: input.status });
      return { id: record.id, slug: record.slug };
    }, { isolationLevel: "Serializable" }));
  },
  countProductsInCategory(categoryId) { return prisma.product.count({ where: { categoryId, deletedAt: null } }); },
  async archiveCategory(categoryId, actorId, version) { await serializableRetry(() => prisma.$transaction(async (tx) => { if (await tx.product.count({ where: { categoryId, deletedAt: null } })) throw new Error("This category is referenced by products and cannot be archived"); const changed = await tx.productCategory.updateMany({ where: { id: categoryId, deletedAt: null, updatedAt: new Date(version) }, data: { status: "ARCHIVED", deletedAt: new Date() } }); if (changed.count !== 1) throw new Error("Category changed by another administrator"); await audit(tx, actorId, "PRODUCT_CATEGORY_ARCHIVED", "ProductCategory", categoryId); }, { isolationLevel: "Serializable" })); },
};

export const prismaNewsAdminRepository: NewsAdminRepository = {
  async saveArticle(input: NewsAdminInput & { actorId: string }) {
    return serializableRetry(() => prisma.$transaction(async (tx) => {
      await assertActiveCategory(tx, "article", input.categoryId, input.status === "PUBLISHED");
      await assertActiveTags(tx, input.tagIds);
      await assertUsableMedia(tx, input.coverMediaId ? [input.coverMediaId] : []);
      const existing = input.id ? await tx.article.findUniqueOrThrow({ where: { id: input.id }, select: { publishedAt: true } }) : null;
      const publication = input.status === "PUBLISHED" ? { status: input.status, scheduledAt: input.scheduledAt ?? null, publishedAt: existing?.publishedAt ?? new Date() } : { status: input.status, scheduledAt: input.scheduledAt ?? null, publishedAt: existing?.publishedAt ?? null };
      const common = { categoryId: input.categoryId, authorId: input.actorId, slug: input.slug, coverMediaId: input.coverMediaId ?? null, ...publication };
      let record;
      if (input.id) { if (!input.version) throw new Error("content_conflict"); const updated = await tx.article.updateMany({ where: { id: input.id, updatedAt: new Date(input.version) }, data: common }); if (updated.count !== 1) throw new Error("content_conflict"); record = await tx.article.update({ where: { id: input.id }, data: { tags: { set: input.tagIds.map((id) => ({ id })) } } }); } else record = await tx.article.create({ data: { ...common, tags: { connect: input.tagIds.map((id) => ({ id })) } } });
      await tx.articleTranslation.deleteMany({ where: { articleId: record.id } });
      await tx.articleTranslation.createMany({ data: input.translations.map((item) => ({ articleId: record.id, locale: toDatabaseLocale(item.locale), title: item.title, body: item.body, excerpt: item.excerpt })) });
      await audit(tx, input.actorId, input.status === "PUBLISHED" ? "ARTICLE_PUBLISHED" : "ARTICLE_SAVED", "Article", record.id, { slug: record.slug, status: input.status, scheduledAt: input.scheduledAt?.toISOString() ?? null });
      return { id: record.id, slug: record.slug };
    }, { isolationLevel: "Serializable" }));
  },
  countArticlesInCategory(categoryId) { return prisma.article.count({ where: { categoryId, deletedAt: null } }); },
  async archiveCategory(categoryId, actorId, version) { await serializableRetry(() => prisma.$transaction(async (tx) => { if (await tx.article.count({ where: { categoryId, deletedAt: null } })) throw new Error("This category is referenced by articles and cannot be archived"); const changed = await tx.articleCategory.updateMany({ where: { id: categoryId, deletedAt: null, updatedAt: new Date(version) }, data: { status: "ARCHIVED", deletedAt: new Date() } }); if (changed.count !== 1) throw new Error("Category changed by another administrator"); await audit(tx, actorId, "ARTICLE_CATEGORY_ARCHIVED", "ArticleCategory", categoryId); }, { isolationLevel: "Serializable" })); },
  countArticlesWithTag(tagId) { return prisma.article.count({ where: { deletedAt: null, tags: { some: { id: tagId } } } }); },
  async archiveTag(tagId, actorId, version) { await serializableRetry(() => prisma.$transaction(async (tx) => { if (await tx.article.count({ where: { deletedAt: null, tags: { some: { id: tagId } } } })) throw new Error("This tag is referenced by articles and cannot be archived"); const changed = await tx.tag.updateMany({ where: { id: tagId, deletedAt: null, updatedAt: new Date(version) }, data: { deletedAt: new Date() } }); if (changed.count !== 1) throw new Error("Tag changed by another administrator"); await audit(tx, actorId, "TAG_ARCHIVED", "Tag", tagId); }, { isolationLevel: "Serializable" })); },
};

export const prismaInquiryAdminRepository: InquiryAdminRepository = {
  async getStatus(inquiryId) { const record = await prisma.inquiry.findUnique({ where: { id: inquiryId }, select: { status: true } }); return record?.status ?? null; },
  async updateStatus(input) { return serializableRetry(() => prisma.$transaction(async (tx) => { const updated = await tx.inquiry.updateMany({ where: { id: input.inquiryId, status: input.expectedStatus }, data: { status: input.status } }); if (updated.count !== 1) return false; await audit(tx, input.actorId, "INQUIRY_STATUS_CHANGED", "Inquiry", input.inquiryId, { from: input.expectedStatus, status: input.status }); return true; }, { isolationLevel: "Serializable" })); },
  async saveNotes(input) { return serializableRetry(() => prisma.$transaction(async (tx) => { const updated = await tx.inquiry.updateMany({ where: { id: input.inquiryId }, data: { internalNotes: input.internalNotes } }); if (updated.count !== 1) return false; await audit(tx, input.actorId, "INQUIRY_NOTES_UPDATED", "Inquiry", input.inquiryId); return true; }, { isolationLevel: "Serializable" })); },
};

export const prismaUserAdminRepository: UserAdminRepository = {
  async createUser(input) { return serializableRetry(() => prisma.$transaction(async (tx) => { const user = await tx.user.create({ data: { email: input.email, passwordHash: input.passwordHash, role: input.role } }); await audit(tx, input.actorId, "USER_CREATED", "User", user.id, { role: user.role }); return { id: user.id }; }, { isolationLevel: "Serializable" })); },
  countActiveAdmins() { return prisma.user.count({ where: { role: "ADMIN", isActive: true, deletedAt: null } }); },
  async updateUser(input) { await serializableRetry(() => prisma.$transaction(async (tx) => { const current = await tx.user.findUniqueOrThrow({ where: { id: input.id }, select: { role: true, isActive: true } }); if ((input.isActive === false || input.role === "EDITOR") && current.role === "ADMIN" && current.isActive) { const activeAdmins = await tx.user.count({ where: { role: "ADMIN", isActive: true, deletedAt: null } }); if (activeAdmins <= 1) throw new Error("last_active_administrator"); } await tx.user.update({ where: { id: input.id }, data: { role: input.role, isActive: input.isActive, passwordHash: input.passwordHash } }); await audit(tx, input.actorId, "USER_UPDATED", "User", input.id, { role: input.role, isActive: input.isActive }); }, { isolationLevel: "Serializable" })); },
};

export const prismaInquiryExportRepository = {
  async *streamRows(filters: { q?: string; status?: "NEW" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED"; start?: string; end?: string }) {
    const where = inquiryWhere(filters);
    let cursor: string | undefined;
    for (;;) {
      const rows = await prisma.inquiry.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, companyName: true, contactName: true, email: true, country: true, message: true, status: true, createdAt: true } });
      if (!rows.length) return;
      for (const row of rows) yield row;
      cursor = rows.at(-1)?.id;
      if (rows.length < 100) return;
    }
  },
  async auditExport(input: { actorId: string; filters: { q?: string; status?: string; start?: string; end?: string } }) { await prisma.auditLog.create({ data: { actorId: input.actorId, action: "INQUIRIES_EXPORTED", entityType: "Inquiry", metadata: json({ q: input.filters.q ?? null, status: input.filters.status ?? null, start: input.filters.start ?? null, end: input.filters.end ?? null }) } }); },
};

export async function serializableRetry<T>(work: () => Promise<T>, attempts = 3): Promise<T> {
  let failure: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await work(); } catch (error) { failure = error; if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2034") || attempt === attempts - 1) throw error; }
  }
  throw failure;
}

export async function publishDueContent(now = new Date()) {
  return serializableRetry(() => prisma.$transaction(async (tx) => {
    const [dueArticles, dueProducts] = await Promise.all([
      tx.article.findMany({ where: { status: "DRAFT", scheduledAt: { lte: now }, deletedAt: null }, include: { translations: true, category: true, tags: true, coverMedia: true }, take: 100 }),
      tx.product.findMany({ where: { status: "DRAFT", scheduledAt: { lte: now }, deletedAt: null }, include: { translations: true, category: true, media: true }, take: 100 }),
    ]);
    const articles: Array<{ id: string; slug: string }> = []; const products: Array<{ id: string; slug: string }> = [];
    for (const item of dueArticles) {
      const english = item.translations.some((translation) => translation.locale === "en" && translation.title.trim() && translation.body.trim());
      const category = item.category.deletedAt === null && item.category.status === "PUBLISHED";
      const tags = item.tags.every((tag) => tag.deletedAt === null);
      const media = !item.coverMedia || (item.coverMedia.deletedAt === null && item.coverMedia.status === "PUBLISHED" && item.coverMedia.visibility === "PUBLIC");
      if (!english || !category || !tags || !media) { const failed = await tx.article.updateMany({ where: { id: item.id, status: "DRAFT", scheduledAt: { lte: now } }, data: { scheduledAt: null } }); if (failed.count === 1) await audit(tx, null, "ARTICLE_SCHEDULED_PUBLICATION_FAILED", "Article", item.id, { slug: item.slug, english, category, tags, media }); continue; }
      const updated = await tx.article.updateMany({ where: { id: item.id, status: "DRAFT", scheduledAt: { lte: now } }, data: { status: "PUBLISHED", publishedAt: item.publishedAt ?? now, scheduledAt: null } });
      if (updated.count === 1) { await audit(tx, null, "ARTICLE_SCHEDULED_PUBLISHED", "Article", item.id, { slug: item.slug }); articles.push({ id: item.id, slug: item.slug }); }
    }
    for (const item of dueProducts) {
      const english = item.translations.some((translation) => translation.locale === "en" && translation.title.trim() && translation.body.trim());
      const category = item.category.deletedAt === null && item.category.status === "PUBLISHED";
      const media = item.media.every((asset) => asset.deletedAt === null && asset.status === "PUBLISHED" && asset.visibility === "PUBLIC");
      if (!english || !category || !media) { const failed = await tx.product.updateMany({ where: { id: item.id, status: "DRAFT", scheduledAt: { lte: now } }, data: { scheduledAt: null } }); if (failed.count === 1) await audit(tx, null, "PRODUCT_SCHEDULED_PUBLICATION_FAILED", "Product", item.id, { slug: item.slug, english, category, media }); continue; }
      const updated = await tx.product.updateMany({ where: { id: item.id, status: "DRAFT", scheduledAt: { lte: now } }, data: { status: "PUBLISHED", publishedAt: item.publishedAt ?? now, scheduledAt: null } });
      if (updated.count === 1) { await audit(tx, null, "PRODUCT_SCHEDULED_PUBLISHED", "Product", item.id, { slug: item.slug }); products.push({ id: item.id, slug: item.slug }); }
    }
    return { articles, products };
  }, { isolationLevel: "Serializable" }));
}
