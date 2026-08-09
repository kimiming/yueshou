import { unzipSync } from "fflate";

import type { InquiryAttachmentInput } from "./schemas";

const MAX_OOXML_UNCOMPRESSED_BYTES = 30 * 1024 * 1024;

function signatureError(): never {
  throw new Error("inquiry_attachment_signature");
}

export function validateAttachmentBytes(upload: InquiryAttachmentInput, bytes: Uint8Array): void {
  if (bytes.byteLength !== upload.size) signatureError();
  if (upload.type === "application/pdf") {
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") signatureError();
    return;
  }
  if (upload.type === "text/plain" || upload.type === "text/csv") {
    if (bytes.includes(0)) signatureError();
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      signatureError();
    }
    return;
  }
  let expanded = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter(file) {
        expanded += file.originalSize;
        if (expanded > MAX_OOXML_UNCOMPRESSED_BYTES || file.originalSize > MAX_OOXML_UNCOMPRESSED_BYTES) signatureError();
        return file.name === "[Content_Types].xml" || file.name.startsWith("word/") || file.name.startsWith("xl/");
      },
    });
  } catch {
    signatureError();
  }
  if (!("[Content_Types].xml" in files)) signatureError();
  const prefix = upload.type.includes("wordprocessingml") ? "word/" : "xl/";
  if (!Object.keys(files).some((name) => name.startsWith(prefix))) signatureError();
}
