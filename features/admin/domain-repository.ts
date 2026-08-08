import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { toDatabaseLocale } from "@/lib/i18n/config";
import type { InquiryAdminRepository } from "./inquiries";
import type { NewsAdminInput, NewsAdminRepository } from "./news";
import type { ProductAdminInput, ProductAdminRepository } from "./products";
import type { UserAdminRepository } from "./users";

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const audit = (tx: Prisma.TransactionClient, actorId: string | null, action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) => tx.auditLog.create({ data: { actorId: actorId ?? undefined, action, entityType, entityId, metadata: metadata ? json(metadata) : undefined } });

function published(status: "DRAFT" | "PUBLISHED" | "ARCHIVED", scheduledAt?: Date | null) { return { status, scheduledAt: scheduledAt ?? null, publishedAt: status === "PUBLISHED" ? new Date() : null }; }
async function assertUsableMedia(tx: Prisma.TransactionClient, ids: readonly string[]) {
  const unique = [...new Set(ids)]; if (!unique.length) return;
  const count = await tx.mediaAsset.count({ where: { id: { in: unique }, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null, OR: [{ deletionJob: { is: null } }, { deletionJob: { is: { status: "COMPLETED" } } }] } });
  if (count !== unique.length) throw new Error("Referenced media must be published, public, and available");
}

export const prismaProductAdminRepository: ProductAdminRepository = {
  async saveProduct(input: ProductAdminInput & { actorId: string }) {
    return prisma.$transaction(async (tx) => {
      await assertUsableMedia(tx, input.mediaIds);
      const payload = { categoryId: input.categoryId, slug: input.slug, casNumber: input.casNumber ?? null, sequence: input.sequence ?? null, specifications: input.specifications ? json(input.specifications) : undefined, ...published(input.status, input.scheduledAt) };
      const record = input.id ? await tx.product.update({ where: { id: input.id }, data: { ...payload, media: { set: input.mediaIds.map((id) => ({ id })) } } }) : await tx.product.create({ data: { ...payload, media: { connect: input.mediaIds.map((id) => ({ id })) } } });
      await tx.productTranslation.deleteMany({ where: { productId: record.id } });
      await tx.productTranslation.createMany({ data: input.translations.map((item) => ({ productId: record.id, locale: toDatabaseLocale(item.locale), title: item.title, body: item.body })) });
      await audit(tx, input.actorId, input.status === "PUBLISHED" ? "PRODUCT_PUBLISHED" : "PRODUCT_SAVED", "Product", record.id, { slug: record.slug, status: input.status });
      return { id: record.id, slug: record.slug };
    }, { isolationLevel: "Serializable" });
  },
  countProductsInCategory(categoryId) { return prisma.product.count({ where: { categoryId, deletedAt: null } }); },
  async archiveCategory(categoryId, actorId) { await prisma.$transaction(async (tx) => { await tx.productCategory.update({ where: { id: categoryId }, data: { status: "ARCHIVED", deletedAt: new Date() } }); await audit(tx, actorId, "PRODUCT_CATEGORY_ARCHIVED", "ProductCategory", categoryId); }); },
};

export const prismaNewsAdminRepository: NewsAdminRepository = {
  async saveArticle(input: NewsAdminInput & { actorId: string }) {
    return prisma.$transaction(async (tx) => {
      await assertUsableMedia(tx, input.coverMediaId ? [input.coverMediaId] : []);
      const common = { categoryId: input.categoryId, authorId: input.actorId, slug: input.slug, coverMediaId: input.coverMediaId ?? null, ...published(input.status, input.scheduledAt) };
      const record = input.id ? await tx.article.update({ where: { id: input.id }, data: { ...common, tags: { set: input.tagIds.map((id) => ({ id })) } } }) : await tx.article.create({ data: { ...common, tags: { connect: input.tagIds.map((id) => ({ id })) } } });
      await tx.articleTranslation.deleteMany({ where: { articleId: record.id } });
      await tx.articleTranslation.createMany({ data: input.translations.map((item) => ({ articleId: record.id, locale: toDatabaseLocale(item.locale), title: item.title, body: item.body, excerpt: item.excerpt })) });
      await audit(tx, input.actorId, input.status === "PUBLISHED" ? "ARTICLE_PUBLISHED" : "ARTICLE_SAVED", "Article", record.id, { slug: record.slug, status: input.status, scheduledAt: input.scheduledAt?.toISOString() ?? null });
      return { id: record.id, slug: record.slug };
    }, { isolationLevel: "Serializable" });
  },
  countArticlesInCategory(categoryId) { return prisma.article.count({ where: { categoryId, deletedAt: null } }); },
  async archiveCategory(categoryId, actorId) { await prisma.$transaction(async (tx) => { await tx.articleCategory.update({ where: { id: categoryId }, data: { status: "ARCHIVED", deletedAt: new Date() } }); await audit(tx, actorId, "ARTICLE_CATEGORY_ARCHIVED", "ArticleCategory", categoryId); }); },
};

export const prismaInquiryAdminRepository: InquiryAdminRepository = {
  async getStatus(inquiryId) { const record = await prisma.inquiry.findUnique({ where: { id: inquiryId }, select: { status: true } }); return record?.status ?? null; },
  async updateStatus(input) { await prisma.$transaction(async (tx) => { await tx.inquiry.update({ where: { id: input.inquiryId }, data: { status: input.status, internalNotes: input.internalNotes } }); await audit(tx, input.actorId, "INQUIRY_STATUS_CHANGED", "Inquiry", input.inquiryId, { status: input.status }); }); },
};

export const prismaUserAdminRepository: UserAdminRepository = {
  async createUser(input) { return prisma.$transaction(async (tx) => { const user = await tx.user.create({ data: { email: input.email, passwordHash: input.passwordHash, role: input.role } }); await audit(tx, input.actorId, "USER_CREATED", "User", user.id, { role: user.role }); return { id: user.id }; }); },
  countActiveAdmins() { return prisma.user.count({ where: { role: "ADMIN", isActive: true, deletedAt: null } }); },
  async updateUser(input) { await prisma.$transaction(async (tx) => { const current = await tx.user.findUniqueOrThrow({ where: { id: input.id }, select: { role: true, isActive: true } }); if ((input.isActive === false || input.role === "EDITOR") && current.role === "ADMIN" && current.isActive) { const activeAdmins = await tx.user.count({ where: { role: "ADMIN", isActive: true, deletedAt: null } }); if (activeAdmins <= 1) throw new Error("last_active_administrator"); } await tx.user.update({ where: { id: input.id }, data: { role: input.role, isActive: input.isActive, passwordHash: input.passwordHash } }); await audit(tx, input.actorId, "USER_UPDATED", "User", input.id, { role: input.role, isActive: input.isActive }); }, { isolationLevel: "Serializable" }); },
};

export const prismaInquiryExportRepository = {
  async *streamRows(filters: { status?: "NEW" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED"; from?: Date; to?: Date }) {
    const rows = await prisma.inquiry.findMany({ where: { ...(filters.status ? { status: filters.status } : {}), ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}) }, orderBy: { createdAt: "desc" }, select: { id: true, companyName: true, contactName: true, email: true, country: true, message: true, status: true, createdAt: true } });
    for (const row of rows) yield row;
  },
};

export async function publishDueContent(now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const [articles, products] = await Promise.all([
      tx.article.updateManyAndReturn({ where: { status: "DRAFT", scheduledAt: { lte: now }, deletedAt: null }, data: { status: "PUBLISHED", publishedAt: now, scheduledAt: null }, select: { id: true, slug: true } }),
      tx.product.updateManyAndReturn({ where: { status: "DRAFT", scheduledAt: { lte: now }, deletedAt: null }, data: { status: "PUBLISHED", publishedAt: now, scheduledAt: null }, select: { id: true, slug: true } }),
    ]);
    await Promise.all([...articles.map((item) => audit(tx, null, "ARTICLE_SCHEDULED_PUBLISHED", "Article", item.id, { slug: item.slug })), ...products.map((item) => audit(tx, null, "PRODUCT_SCHEDULED_PUBLISHED", "Product", item.id, { slug: item.slug }))]);
    return { articles, products };
  }, { isolationLevel: "Serializable" });
}
