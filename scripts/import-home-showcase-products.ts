import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { ContentLocale } from "@prisma/client";

import { inspectAndSanitizeImage } from "../features/media/image-validation";
import { prisma } from "../lib/db/prisma";
import { createS3Storage } from "../lib/storage/s3-storage";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Usage: import-home-showcase-products.ts <source-path>");

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const storage = createS3Storage({
  backend: "minio",
  endpoint: requiredEnv("STORAGE_ENDPOINT"),
  region: requiredEnv("STORAGE_REGION"),
  bucket: requiredEnv("STORAGE_BUCKET"),
  accessKeyId: requiredEnv("STORAGE_ACCESS_KEY_ID"),
  secretAccessKey: requiredEnv("STORAGE_SECRET_ACCESS_KEY"),
});

async function main() {
  const image = await inspectAndSanitizeImage({ bytes: await readFile(sourcePath), declaredMimeType: "image/jpeg" });
  const storageKey = "media/home/products/zpc-showcase-product.jpg";
  const sha256 = createHash("sha256").update(image.bytes).digest("hex");
  await storage.putImmutableObject({ key: storageKey, body: image.bytes, contentType: image.mimeType, sha256 });
  const now = new Date();
  const media = await prisma.mediaAsset.upsert({
    where: { storageKey },
    update: { filename: "zpc-showcase-product.jpg", mimeType: image.mimeType, sizeBytes: image.bytes.byteLength, width: image.width, height: image.height, visibility: "PUBLIC", status: "PUBLISHED", publishedAt: now, deletedAt: null },
    create: { storageKey, filename: "zpc-showcase-product.jpg", mimeType: image.mimeType, sizeBytes: image.bytes.byteLength, width: image.width, height: image.height, visibility: "PUBLIC", status: "PUBLISHED", publishedAt: now },
  });

  const category = await prisma.productCategory.upsert({
    where: { slug: "featured-peptides" },
    update: { status: "PUBLISHED", publishedAt: now, deletedAt: null },
    create: { slug: "featured-peptides", position: 5, status: "PUBLISHED", publishedAt: now },
  });
  const locales = Object.values(ContentLocale);
  for (const locale of locales) {
    await prisma.mediaAssetTranslation.upsert({
      where: { mediaAssetId_locale: { mediaAssetId: media.id, locale } },
      update: { title: "ZPC peptide product", body: "ZPC peptide product presentation", alt: "ZPC peptide product" },
      create: { mediaAssetId: media.id, locale, title: "ZPC peptide product", body: "ZPC peptide product presentation", alt: "ZPC peptide product" },
    });
    await prisma.productCategoryTranslation.upsert({
      where: { productCategoryId_locale: { productCategoryId: category.id, locale } },
      update: { title: "Featured Peptides", body: "Selected ZPC peptide solutions." },
      create: { productCategoryId: category.id, locale, title: "Featured Peptides", body: "Selected ZPC peptide solutions." },
    });
  }

  for (let number = 8; number <= 27; number += 1) {
    const family = number % 2 === 0 ? "Wrinklend" : "Creasend";
    const code = String(number).padStart(3, "0");
    const title = `ZPC®${family}${code}S`;
    const slug = `zpc-${family.toLowerCase()}-${code}s`;
    const body = `<p>${title} is a ZPC peptide solution developed for professional beauty and research applications.</p><p>Factory-direct supply, consistent quality control, and specification customization are available to support product development and research requirements.</p>`;
    const product = await prisma.product.upsert({
      where: { slug },
      update: { categoryId: category.id, status: "PUBLISHED", publishedAt: now, deletedAt: null, media: { set: [{ id: media.id }] } },
      create: { slug, categoryId: category.id, status: "PUBLISHED", publishedAt: now, media: { connect: [{ id: media.id }] } },
    });
    for (const locale of locales) {
      await prisma.productTranslation.upsert({
        where: { productId_locale: { productId: product.id, locale } },
        update: { title, body },
        create: { productId: product.id, locale, title, body },
      });
    }
  }
  process.stdout.write(`${media.id}\n`);
}

await main().finally(() => prisma.$disconnect());
