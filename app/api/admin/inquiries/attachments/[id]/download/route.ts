import { getInquiryAttachmentDownload } from "@/features/inquiries/attachments";
import { createInquiryAttachmentDownloadHandler } from "@/features/inquiries/download-route";
import { prismaInquiryAttachmentDownloadRepository } from "@/features/inquiries/repository";
import { requireRole } from "@/lib/auth/permissions";
import { parseEnv } from "@/lib/env";
import { createObjectStorage } from "@/lib/storage";

export const runtime = "nodejs";

const GET = createInquiryAttachmentDownloadHandler({
  async authorize() {
    try {
      const user = await requireRole("ADMIN", "EDITOR");
      return { id: user.id, role: user.role };
    } catch {
      return null;
    }
  },
  async getDownload(actor, attachmentId) {
    const env = parseEnv(process.env);
    return getInquiryAttachmentDownload(
      {
        repository: prismaInquiryAttachmentDownloadRepository,
        storage: createObjectStorage(env, env.STORAGE_BACKEND),
      },
      { actor, attachmentId },
    );
  },
});

export { GET };
