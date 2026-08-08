import { createHmac, randomUUID } from "node:crypto";

export const MAX_INQUIRY_FILES = 5;
export const MAX_INQUIRY_TOTAL_BYTES = 75 * 1024 * 1024;

export type UploadCapability = { id: string; secret: string };
export type UploadSessionRecord = {
  id: string; secretDigest: string; emailDigest: string; ipDigest: string | null; expiresAt: Date;
  maxFiles: number; maxBytes: number; usedFiles: number; usedBytes: number; consumedAt: Date | null;
};
export interface UploadSessionRepository {
  create(input: Omit<UploadSessionRecord, "id" | "usedFiles" | "usedBytes" | "consumedAt">): Promise<UploadSessionRecord>;
  reserve(input: { id: string; secretDigest: string; emailDigest: string; now: Date; bytes: number }): Promise<"ok" | "invalid" | "count" | "bytes">;
  verify(input: { id: string; secretDigest: string; emailDigest: string; now: Date }): Promise<boolean>;
}

export function uploadDigest(secret: string, namespace: string, value: string) {
  return createHmac("sha256", secret).update(`${namespace}:${value.trim().toLowerCase()}`).digest("hex");
}

export async function createUploadSession(
  dependencies: { repository: UploadSessionRepository; secret: string; now?: () => Date; randomSecret?: () => string },
  input: { email: string; ip?: string },
): Promise<UploadCapability> {
  const now = dependencies.now?.() ?? new Date();
  const capabilitySecret = dependencies.randomSecret?.() ?? randomUUID();
  const record = await dependencies.repository.create({
    secretDigest: uploadDigest(dependencies.secret, "capability", capabilitySecret),
    emailDigest: uploadDigest(dependencies.secret, "email", input.email),
    ipDigest: input.ip ? uploadDigest(dependencies.secret, "ip", input.ip) : null,
    expiresAt: new Date(now.getTime() + 20 * 60_000), maxFiles: MAX_INQUIRY_FILES, maxBytes: MAX_INQUIRY_TOTAL_BYTES,
  });
  return { id: record.id, secret: capabilitySecret };
}

export async function reserveUploadQuota(
  dependencies: { repository: UploadSessionRepository; secret: string; now?: () => Date },
  input: { capability: UploadCapability; email: string; bytes: number },
) {
  const result = await dependencies.repository.reserve({ id: input.capability.id, secretDigest: uploadDigest(dependencies.secret, "capability", input.capability.secret), emailDigest: uploadDigest(dependencies.secret, "email", input.email), now: dependencies.now?.() ?? new Date(), bytes: input.bytes });
  if (result === "invalid") throw new Error("inquiry_upload_session_invalid");
  if (result === "count") throw new Error("inquiry_error_attachment_count");
  if (result === "bytes") throw new Error("inquiry_error_attachment_bytes");
}

export async function verifyUploadSession(dependencies: { repository: UploadSessionRepository; secret: string; now?: () => Date }, input: { capability: UploadCapability; email: string }) {
  const ok = await dependencies.repository.verify({ id: input.capability.id, secretDigest: uploadDigest(dependencies.secret, "capability", input.capability.secret), emailDigest: uploadDigest(dependencies.secret, "email", input.email), now: dependencies.now?.() ?? new Date() });
  if (!ok) throw new Error("inquiry_upload_session_invalid");
}

export class DeterministicUploadSessionRepository implements UploadSessionRepository {
  #records = new Map<string, UploadSessionRecord>(); #sequence = 0;
  async create(input: Omit<UploadSessionRecord, "id" | "usedFiles" | "usedBytes" | "consumedAt">) {
    const record = { id: `session-${++this.#sequence}`, usedFiles: 0, usedBytes: 0, consumedAt: null, ...input };
    this.#records.set(record.id, record); return record;
  }
  async reserve(input: { id: string; secretDigest: string; emailDigest: string; now: Date; bytes: number }) {
    const record = this.#records.get(input.id);
    if (!Number.isSafeInteger(input.bytes) || input.bytes <= 0 || !record || record.secretDigest !== input.secretDigest || record.emailDigest !== input.emailDigest || record.expiresAt <= input.now || record.consumedAt) return "invalid" as const;
    if (record.usedFiles >= record.maxFiles) return "count" as const;
    if (record.usedBytes + input.bytes > record.maxBytes) return "bytes" as const;
    record.usedFiles += 1; record.usedBytes += input.bytes; return "ok" as const;
  }
  async verify(input: { id: string; secretDigest: string; emailDigest: string; now: Date }) {
    const record = this.#records.get(input.id);
    return Boolean(record && record.secretDigest === input.secretDigest && record.emailDigest === input.emailDigest && record.expiresAt > input.now && !record.consumedAt);
  }
  consume(id: string, at: Date) {
    const record = this.#records.get(id);
    if (record) record.consumedAt = at;
  }
}
