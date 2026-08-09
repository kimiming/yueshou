import { randomUUID } from "node:crypto";

import { z } from "zod";

export const MAX_MEDIA_UPLOAD_BYTES = 25 * 1024 * 1024;

const extensionsByContentType = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
} as const;

export type AllowedMediaType = keyof typeof extensionsByContentType;

export const uploadSchema = z
  .object({
    name: z.string().trim().min(1),
    type: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
    size: z.number().int().positive().max(MAX_MEDIA_UPLOAD_BYTES),
  })
  .superRefine((value, context) => {
    const extension = value.name.split(".").pop()?.toLowerCase();
    if (!extension || !(extensionsByContentType[value.type] as readonly string[]).includes(extension)) {
      context.addIssue({ code: "custom", path: ["name"], message: "File extension does not match content type" });
    }
  });

export type UploadInput = z.infer<typeof uploadSchema>;

export function getMediaExtension(filenameOrKey: string): string {
  return filenameOrKey.split(".").pop()?.toLowerCase() ?? "";
}

export const mediaObjectKeySchema = z.string().regex(
  /^media\/\d{4}\/(?:0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpe?g|png|webp|avif)$/i,
  "Invalid media object key",
);

export const mediaPendingObjectKeySchema = z.string().regex(
  /^media\/pending\/\d{4}\/(?:0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpe?g|png|webp|avif)$/i,
  "Invalid pending media object key",
);

export const completeUploadSchema = uploadSchema.extend({ key: mediaPendingObjectKeySchema });

export function createMediaObjectKey(
  input: UploadInput,
  now = new Date(),
  uuid: () => string = randomUUID,
): string {
  const parsed = uploadSchema.parse(input);
  const extension = getMediaExtension(parsed.name);
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `media/${year}/${month}/${uuid()}.${extension}`;
}

export function createMediaObjectKeys(
  input: UploadInput,
  now = new Date(),
  uuid: () => string = randomUUID,
): { pendingStorageKey: string; finalStorageKey: string } {
  const parsed = uploadSchema.parse(input);
  const extension = getMediaExtension(parsed.name);
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = uuid();
  return {
    pendingStorageKey: `media/pending/${year}/${month}/${id}.${extension}`,
    finalStorageKey: `media/${year}/${month}/${id}.${extension}`,
  };
}
