import { createHash, createHmac } from "node:crypto";

import type { ObjectStorage, PrivateFinalizationStorage } from "@/lib/storage";

import { validateAttachmentBytes } from "./attachment-signatures";
import { createInquiryAttachmentKey, getInquiryAttachmentExtension, inquiryAttachmentKeySchema, inquiryAttachmentSchema, MAX_INQUIRY_ATTACHMENT_BYTES, type InquiryAttachmentInput } from "./schemas";

export type InquiryAttachmentBinding = { submissionToken: string; sessionToken: string; actorToken: string };
export type InquiryUploadIntentRecord = {
  id: string; storageKey: string; submissionHash: string; sessionHash: string; actorHash: string;
  filename: string; mimeType: string; extension: string; sizeBytes: number; expiresAt: Date;
  finalStorageKey: string | null; sha256: string | null; finalizedAt: Date | null; consumedAt: Date | null;
};

export interface InquiryAttachmentRepository {
  createUploadIntent(input: Omit<InquiryUploadIntentRecord, "id" | "finalStorageKey" | "sha256" | "finalizedAt" | "consumedAt">): Promise<InquiryUploadIntentRecord>;
  findUploadIntent(storageKey: string): Promise<InquiryUploadIntentRecord | null>;
  finalizeUploadIntent(input: { intentId: string; binding: ReturnType<typeof hashAttachmentBinding>; storageKey: string; finalStorageKey: string; sha256: string; completedAt: Date }): Promise<{ id: string; finalStorageKey: string } | null>;
  queueTempObjectDeletion(storageKey: string): Promise<void>;
}

export class InquiryAttachmentError extends Error {
  constructor(readonly code: string) { super(code); this.name = "InquiryAttachmentError"; }
}
export class InquiryAttachmentAuthorizationError extends InquiryAttachmentError {
  constructor() { super("inquiry_attachment_forbidden"); this.name = "InquiryAttachmentAuthorizationError"; }
}

function keyed(name: string, value: string, secret: string) {
  if (secret.length < 32 || !value.trim()) throw new InquiryAttachmentAuthorizationError();
  return createHmac("sha256", secret).update(`${name}:${value}`).digest("hex");
}
export function hashAttachmentBinding(input: InquiryAttachmentBinding, secret: string) {
  return { submissionHash: keyed("submission", input.submissionToken, secret), sessionHash: keyed("session", input.sessionToken, secret), actorHash: keyed("actor", input.actorToken, secret) };
}
type Dependencies = { repository: InquiryAttachmentRepository; storage: ObjectStorage & PrivateFinalizationStorage; secret: string; now?: () => Date; uuid?: () => string };

export async function createInquiryAttachmentUpload(dependencies: Dependencies, input: { binding: InquiryAttachmentBinding; upload: InquiryAttachmentInput }) {
  const upload = inquiryAttachmentSchema.parse(input.upload);
  const now = dependencies.now?.() ?? new Date();
  const storageKey = createInquiryAttachmentKey(upload, now, dependencies.uuid);
  await dependencies.repository.createUploadIntent({ storageKey, ...hashAttachmentBinding(input.binding, dependencies.secret), filename: upload.name, mimeType: upload.type, extension: getInquiryAttachmentExtension(upload.name), sizeBytes: upload.size, expiresAt: new Date(now.getTime() + 15 * 60_000) });
  return { key: storageKey, ...await dependencies.storage.presignUpload({ key: storageKey, contentType: upload.type, contentLength: upload.size }) };
}

export async function completeInquiryAttachmentUpload(dependencies: Dependencies, input: { binding: InquiryAttachmentBinding; key: string; upload: InquiryAttachmentInput }) {
  const upload = inquiryAttachmentSchema.parse(input.upload);
  const storageKey = inquiryAttachmentKeySchema.parse(input.key);
  const intent = await dependencies.repository.findUploadIntent(storageKey);
  if (!intent) throw new InquiryAttachmentError("inquiry_upload_intent_not_found");
  if (intent.finalizedAt || intent.consumedAt) throw new InquiryAttachmentError("inquiry_upload_intent_consumed");
  const completedAt = dependencies.now?.() ?? new Date();
  if (intent.expiresAt <= completedAt) throw new InquiryAttachmentError("inquiry_upload_intent_expired");
  const binding = hashAttachmentBinding(input.binding, dependencies.secret);
  if (intent.submissionHash !== binding.submissionHash || intent.sessionHash !== binding.sessionHash || intent.actorHash !== binding.actorHash || intent.filename !== upload.name || intent.mimeType !== upload.type || intent.sizeBytes !== upload.size) throw new InquiryAttachmentAuthorizationError();
  const bytes = await dependencies.storage.readPrivateObject(storageKey, MAX_INQUIRY_ATTACHMENT_BYTES);
  try { validateAttachmentBytes(upload, bytes); } catch { throw new InquiryAttachmentError("inquiry_attachment_signature"); }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const finalStorageKey = `inquiry/final/${sha256}.${intent.extension}`;
  await dependencies.storage.putImmutableObject({ key: finalStorageKey, body: bytes, contentType: upload.type, sha256 });
  const finalized = await dependencies.repository.finalizeUploadIntent({ intentId: intent.id, binding, storageKey, finalStorageKey, sha256, completedAt });
  if (!finalized) throw new InquiryAttachmentError("inquiry_upload_intent_conflict");
  try { await dependencies.storage.deleteObject(storageKey); }
  catch { await dependencies.repository.queueTempObjectDeletion(storageKey); }
  return { token: finalized.id, storageKey: finalized.finalStorageKey, sha256 };
}

export async function getInquiryAttachmentDownload(input: { actor: unknown; attachmentId: string }): Promise<never> { void input; throw new InquiryAttachmentAuthorizationError(); }
