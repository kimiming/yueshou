import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { ContentLocale, Prisma } from "@prisma/client";

import { inspectAndSanitizeImage } from "../features/media/image-validation";
import { prisma } from "../lib/db/prisma";
import { createS3Storage } from "../lib/storage/s3-storage";

const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error("Usage: import-home-services-media.ts <source-directory>");

const assets = [
  {
    file: "yueshou-service-factory.jpg",
    storageKey: "media/home/services/factory-direct-supply.jpg",
    title: "Factory Direct Supply",
    body: "No middlemen, transparent pricing, ensuring product quality and stable supply.",
  },
  {
    file: "yueshou-service-custom.png",
    storageKey: "media/home/services/customized-services.png",
    title: "Customized Services",
    body: "Flexible customization of peptide specifications, rapid response to research and production needs.",
  },
  {
    file: "yueshou-service-quality.jpg",
    storageKey: "media/home/services/quality-assurance.jpg",
    title: "Quality Assurance",
    body: "Professional technical support, free formulation consultation, assisting in product development.",
  },
] as const;

const locales = Object.values(ContentLocale);
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
  const home = await prisma.page.findUniqueOrThrow({ where: { slug: "home" }, select: { id: true } });
  const section = await prisma.pageSection.findFirstOrThrow({
    where: { pageId: home.id, type: "SERVICES", deletedAt: null },
    select: { id: true, config: true },
  });
  const config = section.config && typeof section.config === "object" && !Array.isArray(section.config)
    ? section.config as Record<string, unknown>
    : {};
  const serviceIds = Array.isArray(config.serviceIds)
    ? config.serviceIds.filter((id): id is string => typeof id === "string").slice(0, 3)
    : [];
  if (serviceIds.length !== 3) throw new Error("The homepage Services section must reference at least three services");

  const mediaIds: string[] = [];
  for (const [index, asset] of assets.entries()) {
    const bytes = await readFile(`${sourceDirectory}/${asset.file}`);
    const image = await inspectAndSanitizeImage({ bytes, declaredMimeType: asset.file.endsWith(".png") ? "image/png" : "image/jpeg" });
    const sha256 = createHash("sha256").update(image.bytes).digest("hex");
    await storage.putImmutableObject({ key: asset.storageKey, body: image.bytes, contentType: image.mimeType, sha256 });
    const media = await prisma.mediaAsset.upsert({
      where: { storageKey: asset.storageKey },
      update: { filename: asset.file, mimeType: image.mimeType, sizeBytes: image.bytes.byteLength, width: image.width, height: image.height, visibility: "PUBLIC", status: "PUBLISHED", publishedAt: new Date(), deletedAt: null },
      create: { storageKey: asset.storageKey, filename: asset.file, mimeType: image.mimeType, sizeBytes: image.bytes.byteLength, width: image.width, height: image.height, visibility: "PUBLIC", status: "PUBLISHED", publishedAt: new Date() },
    });
    for (const locale of locales) {
      await prisma.mediaAssetTranslation.upsert({
        where: { mediaAssetId_locale: { mediaAssetId: media.id, locale } },
        update: { title: asset.title, body: asset.body, alt: asset.title },
        create: { mediaAssetId: media.id, locale, title: asset.title, body: asset.body, alt: asset.title },
      });
      await prisma.serviceTranslation.upsert({
        where: { serviceId_locale: { serviceId: serviceIds[index], locale } },
        update: { title: asset.title, body: asset.body },
        create: { serviceId: serviceIds[index], locale, title: asset.title, body: asset.body },
      });
    }
    mediaIds.push(media.id);
  }

  const sectionBody = "Focusing on beauty and research peptides, we offer factory direct supply and customized services to meet diverse needs.";
  await prisma.$transaction([
    ...locales.map((locale) => prisma.pageSectionTranslation.update({
      where: { pageSectionId_locale: { pageSectionId: section.id, locale } },
      data: { body: sectionBody },
    })),
    prisma.pageSection.update({
      where: { id: section.id },
      data: { config: { ...config, serviceIds, imageIds: [mediaIds[2], mediaIds[1], mediaIds[0]] } as Prisma.InputJsonValue },
    }),
  ]);
}

await main().finally(() => prisma.$disconnect());
