import { createHash } from "node:crypto";
import { z } from "zod";

import type { ObjectStorage, PrivateFinalizationStorage } from "@/lib/storage";

import {
  completeUploadSchema,
  createMediaObjectKeys,
  getMediaExtension,
  MAX_MEDIA_UPLOAD_BYTES,
  uploadSchema,
  type UploadInput,
} from "./schemas";
import { ImageValidationError, inspectAndSanitizeImage } from "./image-validation";

export type MediaUploadStorage = ObjectStorage & PrivateFinalizationStorage;

export type MediaActor = {
  id: string;
  role: "ADMIN" | "EDITOR";
};

export type MediaAssetRecord = {
  id: string;
  storageKey: string;
  [key: string]: unknown;
};

export type MediaReferences = {
  pages: number;
  products: number;
  articles: number;
  settings: number;
};

export type MediaUploadIntentRecord = {
  id: string;
  storageKey: string;
  finalStorageKey: string | null;
  actorId: string;
  filename: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  expiresAt: Date;
  consumedAt: Date | null;
};

export interface MediaRepository {
  createUploadIntent(input: Omit<MediaUploadIntentRecord, "id" | "consumedAt" | "finalStorageKey"> & { finalStorageKey: string }): Promise<MediaUploadIntentRecord>;
  findUploadIntent(storageKey: string): Promise<MediaUploadIntentRecord | null>;
  consumeUploadIntent(input: {
    intentId: string;
    actorId: string;
    completedAt: Date;
    pendingStorageKey: string;
    storageKey: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    width: number;
    height: number;
  }): Promise<MediaAssetRecord | null>;
  queueUploadObjectDeletion(input: {
    storageKey: string;
    kind: "MEDIA_PENDING" | "MEDIA_FINAL";
    sourceId: string;
  }): Promise<void>;
  getMediaAsset(id: string): Promise<{ id: string; storageKey: string } | null>;
  countReferences(id: string): Promise<MediaReferences>;
  archiveMediaAsset(id: string, archivedAt: Date): Promise<void>;
  queueObjectDeletion(input: {
    actorId: string;
    mediaAssetId: string;
    storageKey: string;
    deleteAfter: Date;
  }): Promise<void>;
  archiveWithReferences?(input: { actorId: string; mediaAssetId: string; archivedAt: Date; deleteAfter: Date }): Promise<{ retained: boolean; deleteAfter?: Date | null }>;
}

export class MediaDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MediaDomainError";
  }
}

export class MediaAuthorizationError extends MediaDomainError {

  constructor(message = "Media operation is not authorized") {
    super("media_forbidden", message, 403);
    this.name = "MediaAuthorizationError";
  }
}

export class MediaMetadataMismatchError extends MediaDomainError {
  constructor() {
    super("media_metadata_mismatch", "Stored object metadata does not match the upload intent", 409);
    this.name = "MediaMetadataMismatchError";
  }
}

export class MediaImageValidationError extends MediaDomainError {
  constructor(code = "media_image_invalid") {
    super(code, "Uploaded image bytes are not a valid supported image", 422);
    this.name = "MediaImageValidationError";
  }
}

export class MediaAssetNotFoundError extends MediaDomainError {
  constructor() {
    super("media_asset_not_found", "Media asset not found", 404);
    this.name = "MediaAssetNotFoundError";
  }
}

export class MediaUploadIntentNotFoundError extends MediaDomainError {
  constructor() {
    super("upload_intent_not_found", "Upload intent not found", 404);
    this.name = "MediaUploadIntentNotFoundError";
  }
}

export class MediaUploadIntentExpiredError extends MediaDomainError {
  constructor() {
    super("upload_intent_expired", "Upload intent has expired", 410);
    this.name = "MediaUploadIntentExpiredError";
  }
}

export class MediaUploadIntentReplayError extends MediaDomainError {
  constructor() {
    super("upload_intent_consumed", "Upload intent has already been consumed", 409);
    this.name = "MediaUploadIntentReplayError";
  }
}

export class MediaUploadIntentMismatchError extends MediaDomainError {
  constructor() {
    super("upload_intent_mismatch", "Upload completion does not match its intent", 409);
    this.name = "MediaUploadIntentMismatchError";
  }
}

export class MediaUploadIntentConflictError extends MediaDomainError {
  constructor() {
    super("upload_intent_conflict", "Upload intent could not be consumed", 409);
    this.name = "MediaUploadIntentConflictError";
  }
}

function requireStaff(actor: MediaActor | null): asserts actor is MediaActor {
  if (!actor || (actor.role !== "ADMIN" && actor.role !== "EDITOR")) {
    throw new MediaAuthorizationError();
  }
}

function requireAdmin(actor: MediaActor | null): asserts actor is MediaActor & { role: "ADMIN" } {
  if (!actor || actor.role !== "ADMIN") {
    throw new MediaAuthorizationError("Administrator role required for destructive media operations");
  }
}

export async function createPendingUpload(
  dependencies: {
    storage: ObjectStorage;
    repository: MediaRepository;
    now?: () => Date;
    uuid?: () => string;
  },
  input: { actor: MediaActor | null; upload: UploadInput },
) {
  requireStaff(input.actor);
  const upload = uploadSchema.parse(input.upload);
  const now = dependencies.now?.() ?? new Date();
  const { pendingStorageKey: key, finalStorageKey } = createMediaObjectKeys(upload, now, dependencies.uuid);
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
  await dependencies.repository.createUploadIntent({
    storageKey: key,
    finalStorageKey,
    actorId: input.actor.id,
    filename: upload.name,
    mimeType: upload.type,
    extension: getMediaExtension(key),
    sizeBytes: upload.size,
    expiresAt,
  });
  const presigned = await dependencies.storage.presignUpload({
    key,
    contentType: upload.type,
    contentLength: upload.size,
  });
  return { key, ...presigned };
}

export async function completeUpload(
  dependencies: { storage: MediaUploadStorage; repository: MediaRepository; now?: () => Date },
  input: { actor: MediaActor | null; key: string; upload: UploadInput },
): Promise<MediaAssetRecord> {
  requireStaff(input.actor);
  const completed = completeUploadSchema.parse({ key: input.key, ...input.upload });
  const intent = await dependencies.repository.findUploadIntent(completed.key);
  if (!intent) throw new MediaUploadIntentNotFoundError();
  if (intent.consumedAt) throw new MediaUploadIntentReplayError();

  const completedAt = dependencies.now?.() ?? new Date();
  if (intent.expiresAt.getTime() <= completedAt.getTime()) throw new MediaUploadIntentExpiredError();
  const finalStorageKey = intent.finalStorageKey;

  if (
    !finalStorageKey ||
    intent.actorId !== input.actor.id ||
    intent.storageKey !== completed.key ||
    intent.mimeType !== completed.type ||
    intent.sizeBytes !== completed.size ||
    intent.extension !== getMediaExtension(completed.key) ||
    intent.extension !== getMediaExtension(completed.name)
  ) {
    throw new MediaUploadIntentMismatchError();
  }

  const metadata = await dependencies.storage.headObject(completed.key);
  if (metadata.contentType !== intent.mimeType || metadata.contentLength !== intent.sizeBytes) {
    await dependencies.repository.queueUploadObjectDeletion({ storageKey: intent.storageKey, kind: "MEDIA_PENDING", sourceId: intent.id });
    throw new MediaMetadataMismatchError();
  }

  const bytes = await dependencies.storage.readPrivateObject(completed.key, MAX_MEDIA_UPLOAD_BYTES + 1);
  if (bytes.byteLength !== intent.sizeBytes) {
    await dependencies.repository.queueUploadObjectDeletion({ storageKey: intent.storageKey, kind: "MEDIA_PENDING", sourceId: intent.id });
    throw new MediaMetadataMismatchError();
  }

  let inspected;
  try {
    inspected = await inspectAndSanitizeImage({
      bytes,
      declaredMimeType: intent.mimeType as UploadInput["type"],
    });
  } catch (error) {
    await dependencies.repository.queueUploadObjectDeletion({ storageKey: intent.storageKey, kind: "MEDIA_PENDING", sourceId: intent.id });
    if (error instanceof ImageValidationError) throw new MediaImageValidationError(error.code);
    throw error;
  }

  try {
    await dependencies.storage.putImmutableObject({
      key: finalStorageKey,
      body: inspected.bytes,
      contentType: inspected.mimeType,
      sha256: createHash("sha256").update(inspected.bytes).digest("hex"),
    });
  } catch (error) {
    await Promise.all([
      dependencies.repository.queueUploadObjectDeletion({ storageKey: intent.storageKey, kind: "MEDIA_PENDING", sourceId: intent.id }),
      dependencies.repository.queueUploadObjectDeletion({ storageKey: finalStorageKey, kind: "MEDIA_FINAL", sourceId: intent.id }),
    ]);
    throw error;
  }

  const media = await dependencies.repository.consumeUploadIntent({
    intentId: intent.id,
    actorId: input.actor.id,
    completedAt,
    pendingStorageKey: intent.storageKey,
    storageKey: finalStorageKey,
    filename: intent.filename,
    mimeType: inspected.mimeType,
    sizeBytes: inspected.bytes.byteLength,
    width: inspected.width,
    height: inspected.height,
  });
  if (!media) {
    await Promise.all([
      dependencies.repository.queueUploadObjectDeletion({ storageKey: intent.storageKey, kind: "MEDIA_PENDING", sourceId: intent.id }),
      dependencies.repository.queueUploadObjectDeletion({ storageKey: finalStorageKey, kind: "MEDIA_FINAL", sourceId: intent.id }),
    ]);
    throw new MediaUploadIntentConflictError();
  }
  try {
    await dependencies.storage.deleteObject(intent.storageKey);
  } catch {
    await dependencies.repository.queueUploadObjectDeletion({ storageKey: intent.storageKey, kind: "MEDIA_PENDING", sourceId: intent.id });
  }
  return media;
}

const archiveInputSchema = z.object({ mediaAssetId: z.string().min(1) });

export async function archiveMediaAsset(
  dependencies: { repository: MediaRepository; now?: () => Date },
  input: { actor: MediaActor | null; mediaAssetId: string },
) {
  requireAdmin(input.actor);
  const { mediaAssetId } = archiveInputSchema.parse(input);
  const archivedAt = dependencies.now?.() ?? new Date();
  const deleteAfter = new Date(archivedAt);
  deleteAfter.setUTCDate(deleteAfter.getUTCDate() + 30);
  if (dependencies.repository.archiveWithReferences) {
    const result = await dependencies.repository.archiveWithReferences({ actorId: input.actor.id, mediaAssetId, archivedAt, deleteAfter });
    return { archived: true, retained: result.retained, deleteAfter: result.retained ? null : result.deleteAfter ?? deleteAfter };
  }
  const media = await dependencies.repository.getMediaAsset(mediaAssetId);
  if (!media) throw new MediaAssetNotFoundError();

  const references = await dependencies.repository.countReferences(mediaAssetId);
  await dependencies.repository.archiveMediaAsset(mediaAssetId, archivedAt);

  const retained = Object.values(references).some((count) => count > 0);
  if (retained) return { archived: true, retained: true, deleteAfter: null };

  await dependencies.repository.queueObjectDeletion({
    actorId: input.actor.id,
    mediaAssetId,
    storageKey: media.storageKey,
    deleteAfter,
  });
  return { archived: true, retained: false, deleteAfter };
}

export function createMediaService(dependencies: {
  storage: MediaUploadStorage;
  repository: MediaRepository;
  now?: () => Date;
  uuid?: () => string;
}) {
  return {
    createPendingUpload: (input: { actor: MediaActor | null; upload: UploadInput }) =>
      createPendingUpload(dependencies, input),
    completeUpload: (input: { actor: MediaActor | null; key: string; upload: UploadInput }) =>
      completeUpload(dependencies, input),
    archiveMediaAsset: (input: { actor: MediaActor | null; mediaAssetId: string }) =>
      archiveMediaAsset(dependencies, input),
  };
}
