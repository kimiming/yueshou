import { z } from "zod";

import type { ObjectStorage } from "@/lib/storage";

import {
  completeUploadSchema,
  createMediaObjectKey,
  uploadSchema,
  type UploadInput,
} from "./schemas";

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

export interface MediaRepository {
  createMediaAsset(input: {
    storageKey: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<MediaAssetRecord>;
  getMediaAsset(id: string): Promise<{ id: string; storageKey: string } | null>;
  countReferences(id: string): Promise<MediaReferences>;
  archiveMediaAsset(id: string, archivedAt: Date): Promise<void>;
  queueObjectDeletion(input: {
    actorId: string;
    mediaAssetId: string;
    storageKey: string;
    deleteAfter: Date;
  }): Promise<void>;
}

export class MediaAuthorizationError extends Error {
  readonly status = 403;

  constructor(message = "Media operation is not authorized") {
    super(message);
    this.name = "MediaAuthorizationError";
  }
}

export class MediaMetadataMismatchError extends Error {
  readonly status = 409;

  constructor() {
    super("Stored object metadata does not match the requested upload");
    this.name = "MediaMetadataMismatchError";
  }
}

export class MediaAssetNotFoundError extends Error {
  readonly status = 404;

  constructor() {
    super("Media asset not found");
    this.name = "MediaAssetNotFoundError";
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
    now?: () => Date;
    uuid?: () => string;
  },
  input: { actor: MediaActor | null; upload: UploadInput },
) {
  requireStaff(input.actor);
  const upload = uploadSchema.parse(input.upload);
  const key = createMediaObjectKey(upload, dependencies.now?.() ?? new Date(), dependencies.uuid);
  const presigned = await dependencies.storage.presignUpload({
    key,
    contentType: upload.type,
    contentLength: upload.size,
  });
  return { key, ...presigned };
}

export async function completeUpload(
  dependencies: { storage: ObjectStorage; repository: MediaRepository },
  input: { actor: MediaActor | null; key: string; upload: UploadInput },
): Promise<MediaAssetRecord> {
  requireStaff(input.actor);
  const completed = completeUploadSchema.parse({ key: input.key, ...input.upload });
  const metadata = await dependencies.storage.headObject(completed.key);

  if (metadata.contentType !== completed.type || metadata.contentLength !== completed.size) {
    throw new MediaMetadataMismatchError();
  }

  return dependencies.repository.createMediaAsset({
    storageKey: completed.key,
    filename: completed.name,
    mimeType: completed.type,
    sizeBytes: completed.size,
  });
}

const archiveInputSchema = z.object({ mediaAssetId: z.string().min(1) });

export async function archiveMediaAsset(
  dependencies: { repository: MediaRepository; now?: () => Date },
  input: { actor: MediaActor | null; mediaAssetId: string },
) {
  requireAdmin(input.actor);
  const { mediaAssetId } = archiveInputSchema.parse(input);
  const media = await dependencies.repository.getMediaAsset(mediaAssetId);
  if (!media) throw new MediaAssetNotFoundError();

  const references = await dependencies.repository.countReferences(mediaAssetId);
  const archivedAt = dependencies.now?.() ?? new Date();
  await dependencies.repository.archiveMediaAsset(mediaAssetId, archivedAt);

  const retained = Object.values(references).some((count) => count > 0);
  if (retained) return { archived: true, retained: true, deleteAfter: null };

  const deleteAfter = new Date(archivedAt);
  deleteAfter.setUTCDate(deleteAfter.getUTCDate() + 30);
  await dependencies.repository.queueObjectDeletion({
    actorId: input.actor.id,
    mediaAssetId,
    storageKey: media.storageKey,
    deleteAfter,
  });
  return { archived: true, retained: false, deleteAfter };
}

export function createMediaService(dependencies: {
  storage: ObjectStorage;
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
