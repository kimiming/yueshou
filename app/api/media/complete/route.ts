import { ZodError } from "zod";

import { completeUploadSchema } from "@/features/media/schemas";
import type { MediaActor } from "@/features/media/service";
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
    if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });

    try {
      const body = completeUploadSchema.parse(await request.json());
      const result = await dependencies.completeUpload(actor, body);
      return Response.json(result);
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) {
        return Response.json({ error: "Invalid upload completion" }, { status: 400 });
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
