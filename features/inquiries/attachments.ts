import { createHash } from "node:crypto";
import type { ObjectStorage, PrivateDownloadStorage, PrivateFinalizationStorage } from "@/lib/storage";
import { validateAttachmentBytes } from "./attachment-signatures";
import { createInquiryAttachmentKey, getInquiryAttachmentExtension, inquiryAttachmentKeySchema, inquiryAttachmentSchema, MAX_INQUIRY_ATTACHMENT_BYTES, type InquiryAttachmentInput } from "./schemas";
import { reserveUploadQuota, verifyUploadSession, type UploadCapability, type UploadSessionRepository } from "./upload-session";

export type InquiryAttachmentBinding = UploadCapability & { email: string };
export type InquiryUploadIntentRecord = { id: string; uploadSessionId: string; storageKey: string; filename: string; mimeType: string; extension: string; sizeBytes: number; expiresAt: Date; finalStorageKey: string | null; sha256: string | null; finalizedAt: Date | null; consumedAt: Date | null };
export interface InquiryAttachmentRepository {
  createUploadIntent(input: Omit<InquiryUploadIntentRecord, "id" | "finalStorageKey" | "sha256" | "finalizedAt" | "consumedAt">): Promise<InquiryUploadIntentRecord>;
  findUploadIntent(storageKey: string): Promise<InquiryUploadIntentRecord | null>;
  finalizeUploadIntent(input: { intentId: string; uploadSessionId: string; storageKey: string; finalStorageKey: string; sha256: string; completedAt: Date }): Promise<{ id: string; finalStorageKey: string } | null>;
  queueTempObjectDeletion(storageKey: string): Promise<void>;
}
export class InquiryAttachmentError extends Error { constructor(readonly code: string) { super(code); this.name = "InquiryAttachmentError"; } }
export class InquiryAttachmentAuthorizationError extends InquiryAttachmentError { constructor() { super("inquiry_attachment_forbidden"); } }
export type InquiryAttachmentDownloadActor = { id: string; role: "ADMIN" | "EDITOR" };
export type InquiryAttachmentDownloadRecord = {
  id: string;
  inquiryId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  inquiryStatus: "NEW" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED";
};
export interface InquiryAttachmentDownloadRepository {
  findAttachmentForDownload(id: string): Promise<InquiryAttachmentDownloadRecord | null>;
  auditAttachmentDownload(input: { actorId: string; attachmentId: string; inquiryId: string; accessedAt: Date }): Promise<void>;
}
type Dependencies = { repository: InquiryAttachmentRepository; sessions: UploadSessionRepository; storage: ObjectStorage & PrivateFinalizationStorage; secret: string; now?: () => Date; uuid?: () => string };

export async function createInquiryAttachmentUpload(dependencies: Dependencies, input: { binding: InquiryAttachmentBinding; upload: InquiryAttachmentInput }) {
  const upload = inquiryAttachmentSchema.parse(input.upload); const now = dependencies.now?.() ?? new Date();
  await reserveUploadQuota({ repository: dependencies.sessions, secret: dependencies.secret, now: () => now }, { capability: input.binding, email: input.binding.email, bytes: upload.size });
  const storageKey = createInquiryAttachmentKey(upload, now, dependencies.uuid);
  await dependencies.repository.createUploadIntent({ uploadSessionId: input.binding.id, storageKey, filename: upload.name, mimeType: upload.type, extension: getInquiryAttachmentExtension(upload.name), sizeBytes: upload.size, expiresAt: new Date(now.getTime() + 15 * 60_000) });
  return { key: storageKey, ...await dependencies.storage.presignUpload({ key: storageKey, contentType: upload.type, contentLength: upload.size }) };
}
export async function completeInquiryAttachmentUpload(dependencies: Dependencies, input: { binding: InquiryAttachmentBinding; key: string; upload: InquiryAttachmentInput }) {
  const upload = inquiryAttachmentSchema.parse(input.upload); const storageKey = inquiryAttachmentKeySchema.parse(input.key); const now = dependencies.now?.() ?? new Date();
  await verifyUploadSession({ repository: dependencies.sessions, secret: dependencies.secret, now: () => now }, { capability: input.binding, email: input.binding.email });
  const intent = await dependencies.repository.findUploadIntent(storageKey);
  if (!intent) throw new InquiryAttachmentError("inquiry_upload_intent_not_found");
  if (intent.finalizedAt || intent.consumedAt) throw new InquiryAttachmentError("inquiry_upload_intent_consumed");
  if (intent.expiresAt <= now) throw new InquiryAttachmentError("inquiry_upload_intent_expired");
  if (intent.uploadSessionId !== input.binding.id || intent.filename !== upload.name || intent.mimeType !== upload.type || intent.sizeBytes !== upload.size) throw new InquiryAttachmentAuthorizationError();
  const bytes = await dependencies.storage.readPrivateObject(storageKey, MAX_INQUIRY_ATTACHMENT_BYTES);
  try { validateAttachmentBytes(upload, bytes); } catch { throw new InquiryAttachmentError("inquiry_attachment_signature"); }
  const sha256 = createHash("sha256").update(bytes).digest("hex"); const finalStorageKey = `inquiry/final/${sha256}.${intent.extension}`;
  await dependencies.storage.putImmutableObject({ key: finalStorageKey, body: bytes, contentType: upload.type, sha256 });
  const finalized = await dependencies.repository.finalizeUploadIntent({ intentId: intent.id, uploadSessionId: input.binding.id, storageKey, finalStorageKey, sha256, completedAt: now });
  if (!finalized) throw new InquiryAttachmentError("inquiry_upload_intent_conflict");
  try { await dependencies.storage.deleteObject(storageKey); } catch { await dependencies.repository.queueTempObjectDeletion(storageKey); }
  return { token: finalized.id, storageKey: finalized.finalStorageKey, sha256 };
}
export function getInquiryAttachmentDownload(
  input: { actor: null; attachmentId: string },
): Promise<never>;
export function getInquiryAttachmentDownload(
  dependencies: { repository: InquiryAttachmentDownloadRepository; storage: PrivateDownloadStorage; now?: () => Date },
  input: { actor: InquiryAttachmentDownloadActor | null; attachmentId: string },
): Promise<{ url: string; expiresAt: Date }>;
export async function getInquiryAttachmentDownload(
  dependenciesOrInput:
    | { repository: InquiryAttachmentDownloadRepository; storage: PrivateDownloadStorage; now?: () => Date }
    | { actor: null; attachmentId: string },
  maybeInput?: { actor: InquiryAttachmentDownloadActor | null; attachmentId: string },
) {
  if (!maybeInput || !("repository" in dependenciesOrInput)) {
    throw new InquiryAttachmentAuthorizationError();
  }
  const dependencies = dependenciesOrInput;
  const input = maybeInput;
  if (!input.actor || (input.actor.role !== "ADMIN" && input.actor.role !== "EDITOR")) {
    throw new InquiryAttachmentAuthorizationError();
  }
  if (!input.attachmentId.trim()) throw new InquiryAttachmentError("inquiry_attachment_unavailable");

  const attachment = await dependencies.repository.findAttachmentForDownload(input.attachmentId);
  if (!attachment || attachment.inquiryStatus === "ARCHIVED") {
    throw new InquiryAttachmentError("inquiry_attachment_unavailable");
  }

  try {
    const metadata = await dependencies.storage.headObject(attachment.storageKey);
    if (metadata.contentLength !== attachment.sizeBytes || metadata.contentType !== attachment.mimeType) {
      throw new Error("private_object_metadata_mismatch");
    }
  } catch {
    throw new InquiryAttachmentError("inquiry_attachment_unavailable");
  }

  const signed = await dependencies.storage.presignDownload({
    key: attachment.storageKey,
    filename: attachment.filename,
    expiresIn: 5 * 60,
  });
  await dependencies.repository.auditAttachmentDownload({
    actorId: input.actor.id,
    attachmentId: attachment.id,
    inquiryId: attachment.inquiryId,
    accessedAt: dependencies.now?.() ?? new Date(),
  });
  return signed;
}
