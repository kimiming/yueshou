import { createHmac } from "node:crypto";

import type { ObjectStorage } from "@/lib/storage";

import {
  createInquiryAttachmentKey,
  getInquiryAttachmentExtension,
  inquiryAttachmentKeySchema,
  inquiryAttachmentSchema,
  type InquiryAttachmentInput,
} from "./schemas";

export type InquiryAttachmentBinding = {
  inquiryId: string;
  inquiryToken: string;
  sessionToken: string;
  actorToken: string;
};

export type InquiryUploadIntentRecord = {
  id: string;
  inquiryId: string;
  storageKey: string;
  inquiryTokenHash: string;
  sessionHash: string;
  actorHash: string;
  filename: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  expiresAt: Date;
  consumedAt: Date | null;
};

export interface InquiryAttachmentRepository {
  createUploadIntent(input: Omit<InquiryUploadIntentRecord, "id" | "consumedAt">): Promise<InquiryUploadIntentRecord>;
  findUploadIntent(storageKey: string): Promise<InquiryUploadIntentRecord | null>;
  consumeUploadIntent(input: {
    intentId: string;
    inquiryId: string;
    storageKey: string;
    inquiryTokenHash: string;
    sessionHash: string;
    actorHash: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    completedAt: Date;
  }): Promise<{ id: string; storageKey: string } | null>;
}

export class InquiryAttachmentError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "InquiryAttachmentError";
  }
}

export class InquiryAttachmentAuthorizationError extends InquiryAttachmentError {
  constructor() {
    super("inquiry_attachment_forbidden", "Inquiry attachment access is not authorized");
    this.name = "InquiryAttachmentAuthorizationError";
  }
}

function hashBinding(name: keyof InquiryAttachmentBinding, value: string, secret: string): string {
  if (secret.length < 32) throw new Error("A private keyed hashing secret of at least 32 characters is required");
  if (!value.trim()) throw new InquiryAttachmentAuthorizationError();
  return createHmac("sha256", secret).update(`${name}:${value}`).digest("hex");
}

function bind(input: InquiryAttachmentBinding, secret: string) {
  return {
    inquiryTokenHash: hashBinding("inquiryToken", input.inquiryToken, secret),
    sessionHash: hashBinding("sessionToken", input.sessionToken, secret),
    actorHash: hashBinding("actorToken", input.actorToken, secret),
  };
}

type AttachmentDependencies = {
  repository: InquiryAttachmentRepository;
  storage: ObjectStorage;
  secret: string;
  now?: () => Date;
  uuid?: () => string;
};

export async function createInquiryAttachmentUpload(
  dependencies: AttachmentDependencies,
  input: { binding: InquiryAttachmentBinding; upload: InquiryAttachmentInput },
) {
  const upload = inquiryAttachmentSchema.parse(input.upload);
  const now = dependencies.now?.() ?? new Date();
  const storageKey = createInquiryAttachmentKey(upload, now, dependencies.uuid);
  await dependencies.repository.createUploadIntent({
    inquiryId: input.binding.inquiryId,
    storageKey,
    ...bind(input.binding, dependencies.secret),
    filename: upload.name,
    mimeType: upload.type,
    extension: getInquiryAttachmentExtension(upload.name),
    sizeBytes: upload.size,
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
  });
  const uploadContract = await dependencies.storage.presignUpload({
    key: storageKey,
    contentType: upload.type,
    contentLength: upload.size,
  });
  return { key: storageKey, ...uploadContract };
}

export async function completeInquiryAttachmentUpload(
  dependencies: AttachmentDependencies,
  input: { binding: InquiryAttachmentBinding; key: string; upload: InquiryAttachmentInput },
) {
  const upload = inquiryAttachmentSchema.parse(input.upload);
  const storageKey = inquiryAttachmentKeySchema.parse(input.key);
  const intent = await dependencies.repository.findUploadIntent(storageKey);
  if (!intent) throw new InquiryAttachmentError("inquiry_upload_intent_not_found", "Upload intent not found");
  if (intent.consumedAt) throw new InquiryAttachmentError("inquiry_upload_intent_consumed", "Upload intent has already been consumed");
  const completedAt = dependencies.now?.() ?? new Date();
  if (intent.expiresAt.getTime() <= completedAt.getTime()) {
    throw new InquiryAttachmentError("inquiry_upload_intent_expired", "Upload intent has expired");
  }
  const binding = bind(input.binding, dependencies.secret);
  if (
    intent.inquiryTokenHash !== binding.inquiryTokenHash ||
    intent.inquiryId !== input.binding.inquiryId ||
    intent.sessionHash !== binding.sessionHash ||
    intent.actorHash !== binding.actorHash ||
    intent.filename !== upload.name ||
    intent.mimeType !== upload.type ||
    intent.sizeBytes !== upload.size ||
    intent.extension !== getInquiryAttachmentExtension(upload.name)
  ) {
    throw new InquiryAttachmentAuthorizationError();
  }
  const metadata = await dependencies.storage.headObject(storageKey);
  if (metadata.contentType !== upload.type || metadata.contentLength !== upload.size) {
    throw new InquiryAttachmentError("inquiry_attachment_metadata_mismatch", "Stored attachment metadata does not match its intent");
  }
  const attachment = await dependencies.repository.consumeUploadIntent({
    intentId: intent.id,
    inquiryId: intent.inquiryId,
    storageKey,
    ...binding,
    filename: upload.name,
    mimeType: upload.type,
    sizeBytes: upload.size,
    completedAt,
  });
  if (!attachment) throw new InquiryAttachmentError("inquiry_upload_intent_conflict", "Upload intent could not be consumed");
  return attachment;
}

export async function getInquiryAttachmentDownload(input: { actor: unknown; attachmentId: string }): Promise<never> {
  void input;
  throw new InquiryAttachmentAuthorizationError();
}
