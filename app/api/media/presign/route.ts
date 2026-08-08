import { ZodError } from "zod";

import { uploadSchema } from "@/features/media/schemas";
import type { MediaActor } from "@/features/media/service";

type PresignService = (
  actor: MediaActor,
  upload: { name: string; type: string; size: number },
) => Promise<unknown>;

export type MediaRouteAuthorization = () => Promise<MediaActor | null>;

export function createPresignUploadHandler(dependencies: {
  authorize: MediaRouteAuthorization;
  createPendingUpload: PresignService;
}) {
  return async function POST(request: Request): Promise<Response> {
    const actor = await dependencies.authorize();
    if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });

    try {
      const body = uploadSchema.parse(await request.json());
      const result = await dependencies.createPendingUpload(actor, body);
      return Response.json(result);
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) {
        return Response.json({ error: "Invalid upload request" }, { status: 400 });
      }
      throw error;
    }
  };
}

const denyUntilAuthIsConfigured: MediaRouteAuthorization = async () => null;

export const POST = createPresignUploadHandler({
  authorize: denyUntilAuthIsConfigured,
  createPendingUpload: async () => {
    throw new Error("Media upload service is not configured");
  },
});
