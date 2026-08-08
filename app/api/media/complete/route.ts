import { ZodError } from "zod";

import { completeUploadSchema } from "@/features/media/schemas";
import { MediaDomainError, type MediaActor } from "@/features/media/service";
import type { MediaRouteAuthorization } from "../presign/route";

type CompleteService = (
  actor: MediaActor,
  input: { key: string; name: string; type: string; size: number },
) => Promise<unknown>;

export function createCompleteUploadHandler(dependencies: {
  authorize: MediaRouteAuthorization;
  completeUpload: CompleteService;
}) {
  return async function POST(request: Request): Promise<Response> {
    const actor = await dependencies.authorize();
    if (!actor) {
      return Response.json(
        { error: { code: "unauthorized", message: "Authentication required" } },
        { status: 401 },
      );
    }

    try {
      const body = completeUploadSchema.parse(await request.json());
      const result = await dependencies.completeUpload(actor, body);
      return Response.json(result);
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) {
        return Response.json(
          { error: { code: "invalid_upload_completion", message: "Invalid upload completion" } },
          { status: 400 },
        );
      }
      if (error instanceof MediaDomainError) {
        return Response.json(
          { error: { code: error.code, message: error.message } },
          { status: error.status },
        );
      }
      throw error;
    }
  };
}

export const POST = createCompleteUploadHandler({
  authorize: async () => null,
  completeUpload: async () => {
    throw new Error("Media upload service is not configured");
  },
});
