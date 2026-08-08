import type { InquiryAttachmentInput } from "./schemas";

export type PublicAttachmentBinding = { submissionToken: string; sessionToken: string; actorToken: string };

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
