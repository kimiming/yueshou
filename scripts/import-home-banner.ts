import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { ContentLocale, Prisma } from "@prisma/client";

import { inspectAndSanitizeImage } from "../features/media/image-validation";
import { prisma } from "../lib/db/prisma";
import { createS3Storage } from "../lib/storage/s3-storage";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Usage: import-home-banner.ts <source-path>");

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
  const image = await inspectAndSanitizeImage({
    bytes: await readFile(sourcePath),
    declaredMimeType: "image/png",
  });
  const storageKey = "media/home/hero/yueshou-home-banner.png";
  const sha256 = createHash("sha256").update(image.bytes).digest("hex");
  await storage.putImmutableObject({ key: storageKey, body: image.bytes, contentType: image.mimeType, sha256 });

  const media = await prisma.mediaAsset.upsert({
    where: { storageKey },
    update: { filename: "yueshou-home-banner.png", mimeType: image.mimeType, sizeBytes: image.bytes.byteLength, width: image.width, height: image.height, visibility: "PUBLIC", status: "PUBLISHED", publishedAt: new Date(), deletedAt: null },
    create: { storageKey, filename: "yueshou-home-banner.png", mimeType: image.mimeType, sizeBytes: image.bytes.byteLength, width: image.width, height: image.height, visibility: "PUBLIC", status: "PUBLISHED", publishedAt: new Date() },
  });
  for (const locale of Object.values(ContentLocale)) {
    await prisma.mediaAssetTranslation.upsert({
      where: { mediaAssetId_locale: { mediaAssetId: media.id, locale } },
      update: { title: "Yueshou homepage banner", body: "Homepage hero banner", alt: "Yueshou peptide homepage banner" },
      create: { mediaAssetId: media.id, locale, title: "Yueshou homepage banner", body: "Homepage hero banner", alt: "Yueshou peptide homepage banner" },
    });
  }

  const home = await prisma.page.findUniqueOrThrow({ where: { slug: "home" }, select: { id: true } });
  const hero = await prisma.pageSection.findFirstOrThrow({ where: { pageId: home.id, type: "HERO", deletedAt: null } });
  const config = hero.config && typeof hero.config === "object" && !Array.isArray(hero.config)
    ? hero.config as Record<string, unknown>
    : {};
  await prisma.pageSection.update({
    where: { id: hero.id },
    data: { config: { ...config, imageId: media.id } as Prisma.InputJsonValue },
  });
  process.stdout.write(`${media.id}\n`);
}

await main().finally(() => prisma.$disconnect());
