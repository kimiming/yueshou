import { createHash } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { ContentLocale, LegalReviewStatus, PrismaClient, PublishStatus } from "@prisma/client";
import { Pool } from "pg";

import { inspectAndSanitizeImage } from "../features/media/image-validation";
import {
  E2E_BASELINE_HERO_STORAGE_KEY,
  E2E_BASELINE_LOGO_STORAGE_KEY,
  buildE2eSeedPlan,
} from "../lib/e2e/seed-fixture";
import { createE2eReleaseConfig } from "../lib/e2e/release-config";
import { createS3Storage } from "../lib/storage/s3-storage";

const config = createE2eReleaseConfig(process.env);
const databasePool = new Pool({ connectionString: config.runtime.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.runtime.DATABASE_URL }) });
const storage = createS3Storage({
  backend: "minio",
  endpoint: config.runtime.STORAGE_ENDPOINT,
  region: config.runtime.STORAGE_REGION,
  bucket: config.runtime.STORAGE_BUCKET,
  accessKeyId: config.runtime.STORAGE_ACCESS_KEY_ID,
  secretAccessKey: config.runtime.STORAGE_SECRET_ACCESS_KEY,
});
const locales = [ContentLocale.en, ContentLocale.zh_CN, ContentLocale.de, ContentLocale.fr, ContentLocale.es];

async function assertDisposableDatabase() {
  const identity = await databasePool.query<{ current_database: string; marker: string | null }>(
    "select current_database(), obj_description(oid, 'pg_database') as marker from pg_database where datname = current_database()",
  );
  if (
    identity.rows[0]?.current_database !== config.databaseName
    || identity.rows[0]?.marker !== "YUESHOU_E2E_RELEASE"
  ) throw new Error("Refusing E2E seed without the durable YUESHOU_E2E_RELEASE database marker");
}

async function upsertEnglishTranslations(input: {
  entity: "page" | "service";
  id: string;
  title: string;
  body: string;
}) {
  if (input.entity === "page") {
    for (const locale of locales) {
      await prisma.pageTranslation.upsert({
        where: { pageId_locale: { pageId: input.id, locale } },
        update: { title: input.title, body: input.body, seoTitle: input.title, seoDescription: input.body },
        create: { pageId: input.id, locale, title: input.title, body: input.body, seoTitle: input.title, seoDescription: input.body },
      });
    }
    return;
  }
  for (const locale of locales) {
    await prisma.serviceTranslation.upsert({
      where: { serviceId_locale: { serviceId: input.id, locale } },
      update: { title: input.title, body: input.body },
      create: { serviceId: input.id, locale, title: input.title, body: input.body },
    });
  }
}

async function main() {
  await assertDisposableDatabase();
  const plan = buildE2eSeedPlan();
  const now = new Date();
  const admin = await prisma.user.findUnique({ where: { email: config.runtime.INITIAL_ADMIN_EMAIL } });
  if (!admin || admin.role !== "ADMIN" || !admin.isActive) throw new Error("Ordinary seed did not create the configured E2E administrator");

  const mediaByKey = new Map<string, { id: string }>();
  for (const object of plan.storageObjects) {
    const image = await inspectAndSanitizeImage({ bytes: object.body, declaredMimeType: object.mimeType });
    const sha256 = createHash("sha256").update(image.bytes).digest("hex");
    await storage.putImmutableObject({ key: object.key, body: image.bytes, contentType: image.mimeType, sha256 });
    const media = await prisma.mediaAsset.upsert({
      where: { storageKey: object.key },
      update: {
        filename: object.key.split("/").at(-1) ?? "fixture.png",
        mimeType: image.mimeType,
        sizeBytes: image.bytes.byteLength,
        width: image.width,
        height: image.height,
        visibility: "PUBLIC",
        status: PublishStatus.PUBLISHED,
        publishedAt: now,
        deletedAt: null,
      },
      create: {
        storageKey: object.key,
        filename: object.key.split("/").at(-1) ?? "fixture.png",
        mimeType: image.mimeType,
        sizeBytes: image.bytes.byteLength,
        width: image.width,
        height: image.height,
        visibility: "PUBLIC",
        status: PublishStatus.PUBLISHED,
        publishedAt: now,
      },
    });
    await prisma.mediaAssetTranslation.upsert({
      where: { mediaAssetId_locale: { mediaAssetId: media.id, locale: ContentLocale.en } },
      update: { title: "E2E image fixture", body: "Disposable release fixture", alt: "E2E image fixture" },
      create: { mediaAssetId: media.id, locale: ContentLocale.en, title: "E2E image fixture", body: "Disposable release fixture", alt: "E2E image fixture" },
    });
    mediaByKey.set(object.key, media);
  }

  const baselineLogo = mediaByKey.get(E2E_BASELINE_LOGO_STORAGE_KEY);
  const baselineHero = mediaByKey.get(E2E_BASELINE_HERO_STORAGE_KEY);
  if (!baselineLogo || !baselineHero) throw new Error("Explicit baseline storage fixtures are incomplete");

  const brand = await prisma.siteSetting.findUniqueOrThrow({ where: { key: "brand" } });
  await prisma.siteSetting.update({
    where: { id: brand.id },
    data: {
      status: PublishStatus.PUBLISHED,
      publishedAt: brand.publishedAt ?? now,
      deletedAt: null,
      value: {
        logoMediaId: baselineLogo.id,
        companyName: "YueShou",
        slogan: "Precision Peptide Synthesis for Global Scientific Research",
        email: "research@example.test",
        phone: "+1-555-0100",
        addressLines: ["Disposable E2E laboratory"],
        socialLinks: [],
        footerColumns: [{
          heading: "Legal",
          links: plan.legalPages.map((page) => ({ label: page.title, href: `/legal/${page.slug}` })),
        }],
      },
    },
  });

  const pagesBySlug = new Map<string, { id: string }>();
  for (const item of plan.pages) {
    const page = await prisma.page.upsert({
      where: { slug: item.slug },
      update: {
        status: PublishStatus.PUBLISHED,
        publishedAt: now,
        legalReviewStatus: LegalReviewStatus.NOT_REQUIRED,
        legalReviewedAt: null,
        legalReviewedRevision: null,
        legalReviewedById: null,
        deletedAt: null,
      },
      create: {
        slug: item.slug,
        status: PublishStatus.PUBLISHED,
        publishedAt: now,
        legalReviewStatus: LegalReviewStatus.NOT_REQUIRED,
      },
    });
    await upsertEnglishTranslations({ entity: "page", id: page.id, title: item.title, body: item.body });
    pagesBySlug.set(item.slug, page);
  }

  const home = pagesBySlug.get("home");
  if (!home) throw new Error("E2E home page seed is missing");
  const hero = await prisma.pageSection.upsert({
    where: { pageId_position: { pageId: home.id, position: 0 } },
    update: { type: "HERO", isEnabled: true, config: { imageId: baselineHero.id }, status: PublishStatus.PUBLISHED, publishedAt: now, deletedAt: null },
    create: { pageId: home.id, type: "HERO", position: 0, isEnabled: true, config: { imageId: baselineHero.id }, status: PublishStatus.PUBLISHED, publishedAt: now },
  });
  for (const locale of locales) {
    await prisma.pageSectionTranslation.upsert({
      where: { pageSectionId_locale: { pageSectionId: hero.id, locale } },
      update: { title: "Precision peptide synthesis", body: "Research services for global scientific teams." },
      create: { pageSectionId: hero.id, locale, title: "Precision peptide synthesis", body: "Research services for global scientific teams." },
    });
  }

  for (const item of plan.services) {
    const service = await prisma.service.upsert({
      where: { slug: item.slug },
      update: { position: item.position, status: PublishStatus.PUBLISHED, publishedAt: now, deletedAt: null },
      create: { slug: item.slug, position: item.position, status: PublishStatus.PUBLISHED, publishedAt: now },
    });
    await upsertEnglishTranslations({ entity: "service", id: service.id, title: item.title, body: item.body });
  }

  const productCategory = await prisma.productCategory.upsert({
    where: { slug: plan.products[0].categorySlug },
    update: { status: PublishStatus.PUBLISHED, publishedAt: now, deletedAt: null },
    create: { slug: plan.products[0].categorySlug, status: PublishStatus.PUBLISHED, publishedAt: now },
  });
  await prisma.productCategoryTranslation.upsert({
    where: { productCategoryId_locale: { productCategoryId: productCategory.id, locale: ContentLocale.en } },
    update: { title: "Research peptides", body: "Published E2E category" },
    create: { productCategoryId: productCategory.id, locale: ContentLocale.en, title: "Research peptides", body: "Published E2E category" },
  });
  for (const item of plan.products) {
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: { categoryId: productCategory.id, status: PublishStatus.PUBLISHED, publishedAt: now, deletedAt: null },
      create: { slug: item.slug, categoryId: productCategory.id, status: PublishStatus.PUBLISHED, publishedAt: now },
    });
    await prisma.productTranslation.upsert({
      where: { productId_locale: { productId: product.id, locale: ContentLocale.en } },
      update: { title: item.title, body: item.body },
      create: { productId: product.id, locale: ContentLocale.en, title: item.title, body: item.body },
    });
  }

  const articleCategory = await prisma.articleCategory.upsert({
    where: { slug: plan.articles[0].categorySlug },
    update: { status: PublishStatus.PUBLISHED, publishedAt: now, deletedAt: null },
    create: { slug: plan.articles[0].categorySlug, status: PublishStatus.PUBLISHED, publishedAt: now },
  });
  await prisma.articleCategoryTranslation.upsert({
    where: { articleCategoryId_locale: { articleCategoryId: articleCategory.id, locale: ContentLocale.en } },
    update: { title: "Research updates", body: "Published E2E news category" },
    create: { articleCategoryId: articleCategory.id, locale: ContentLocale.en, title: "Research updates", body: "Published E2E news category" },
  });
  for (const item of plan.articles) {
    const article = await prisma.article.upsert({
      where: { slug: item.slug },
      update: { categoryId: articleCategory.id, authorId: admin.id, status: PublishStatus.PUBLISHED, publishedAt: now, deletedAt: null },
      create: { slug: item.slug, categoryId: articleCategory.id, authorId: admin.id, status: PublishStatus.PUBLISHED, publishedAt: now },
    });
    for (const locale of locales) {
      await prisma.articleTranslation.upsert({
        where: { articleId_locale: { articleId: article.id, locale } },
        update: { title: item.title, body: item.body, excerpt: item.body },
        create: { articleId: article.id, locale, title: item.title, body: item.body, excerpt: item.body },
      });
    }
  }

  for (const item of plan.legalPages) {
    const page = await prisma.page.findUniqueOrThrow({ where: { slug: item.slug } });
    for (const locale of locales) {
      await prisma.pageTranslation.upsert({
        where: { pageId_locale: { pageId: page.id, locale } },
        update: { title: item.title, body: item.body, seoTitle: item.title, seoDescription: item.body },
        create: { pageId: page.id, locale, title: item.title, body: item.body, seoTitle: item.title, seoDescription: item.body },
      });
    }
    const revised = await prisma.page.findUniqueOrThrow({ where: { id: page.id }, select: { contentRevision: true } });
    await prisma.page.update({
      where: { id: page.id },
      data: {
        status: PublishStatus.PUBLISHED,
        publishedAt: now,
        legalReviewStatus: LegalReviewStatus.APPROVED,
        legalReviewedAt: now,
        legalReviewedRevision: revised.contentRevision,
        legalReviewedById: admin.id,
        deletedAt: null,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await databasePool.end();
  })
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    await databasePool.end();
    throw error;
  });
