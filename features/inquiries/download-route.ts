import { InquiryAttachmentError, type InquiryAttachmentDownloadActor } from "./attachments";

export function createInquiryAttachmentDownloadHandler(dependencies: {
  authorize(): Promise<InquiryAttachmentDownloadActor | null>;
  getDownload(actor: InquiryAttachmentDownloadActor, attachmentId: string): Promise<{ url: string; expiresAt: Date }>;
}) {
  return async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
    const actor = await dependencies.authorize();
    if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    try {
      const { id } = await context.params;
      const download = await dependencies.getDownload(actor, id);
      return new Response(null, { status: 302, headers: { location: download.url, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
    } catch (error) {
      if (error instanceof InquiryAttachmentError) {
        const status = error.code === "inquiry_attachment_forbidden" ? 403 : 404;
        return Response.json({ error: "Attachment unavailable" }, { status, headers: { "cache-control": "no-store" } });
      }
      throw error;
    }
  };
}
