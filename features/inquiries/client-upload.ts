import type { InquiryAttachmentInput } from "./schemas";

export type PublicAttachmentBinding = { id: string; secret: string; email: string };

export async function uploadInquiryFiles(
  files: File[],
  binding: PublicAttachmentBinding,
  dependencies: {
    begin: (binding: PublicAttachmentBinding, upload: InquiryAttachmentInput) => Promise<{ key: string; url: string; method: "PUT"; headers: Record<string, string> }>;
    finalize: (binding: PublicAttachmentBinding, key: string, upload: InquiryAttachmentInput) => Promise<{ token: string }>;
    fetch?: typeof fetch;
  },
): Promise<string[]> {
  const fetcher = dependencies.fetch ?? fetch;
  const tokens: string[] = [];
  for (const file of files) {
    const upload = { name: file.name, type: file.type, size: file.size } as InquiryAttachmentInput;
    const intent = await dependencies.begin(binding, upload);
    const response = await fetcher(intent.url, { method: intent.method, headers: intent.headers, body: file });
    if (!response.ok) throw new Error("inquiry_attachment_upload_failed");
    tokens.push((await dependencies.finalize(binding, intent.key, upload)).token);
  }
  return tokens;
}

export async function prepareAndUploadInquiry(
  files: File[],
  fields: FormData,
  dependencies: {
    prepare: (fields: FormData) => Promise<PublicAttachmentBinding>;
    begin: (binding: PublicAttachmentBinding, upload: InquiryAttachmentInput) => Promise<{ key: string; url: string; method: "PUT"; headers: Record<string, string> }>;
    finalize: (binding: PublicAttachmentBinding, key: string, upload: InquiryAttachmentInput) => Promise<{ token: string }>;
    fetch?: typeof fetch;
  },
) {
  if (files.length > 5) throw new Error("inquiry_error_attachment_count");
  if (files.reduce((sum, file) => sum + file.size, 0) > 75 * 1024 * 1024) throw new Error("inquiry_error_attachment_bytes");
  const binding = await dependencies.prepare(fields);
  return { binding, tokens: await uploadInquiryFiles(files, binding, dependencies) };
}
