import { ZodError } from "zod";

import { completeUploadSchema, uploadSchema, type UploadInput } from "./schemas";
import { MediaDomainError, type MediaActor } from "./service";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

type PresignService = (actor: MediaActor, upload: UploadInput) => Promise<unknown>;
type CompleteService = (actor: MediaActor, input: UploadInput & { key: string }) => Promise<unknown>;
export type MediaRouteAuthorization = () => Promise<MediaActor | null>;

export function createMediaRouteAuthorization(getUser: () => Promise<AuthenticatedUser>): MediaRouteAuthorization {
  return async () => {
    try {
      const user = await getUser();
      return { id: user.id, role: user.role };
    } catch {
      return null;
    }
  };
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const allowedOrigins = new Set([new URL(request.url).origin]);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost && (forwardedProto === "https" || forwardedProto === "http")) {
    allowedOrigins.add(`${forwardedProto}://${forwardedHost}`);
  }

  return allowedOrigins.has(origin);
}

export function createPresignUploadHandler(dependencies: { authorize: MediaRouteAuthorization; createPendingUpload: PresignService }) {
  return async function POST(request: Request): Promise<Response> {
    if (!isSameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
    const actor = await dependencies.authorize();
    if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
    try {
      const body = uploadSchema.parse(await request.json());
      return Response.json(await dependencies.createPendingUpload(actor, body));
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json({
          error: {
            code: "invalid_upload_request",
            message: "图片格式、扩展名或文件大小不符合要求",
            fields: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
          },
        }, { status: 400 });
      }
      if (error instanceof SyntaxError) return Response.json({ error: { code: "invalid_json", message: "上传请求格式无效" } }, { status: 400 });
      throw error;
    }
  };
}

export function createCompleteUploadHandler(dependencies: { authorize: MediaRouteAuthorization; completeUpload: CompleteService }) {
  return async function POST(request: Request): Promise<Response> {
    if (!isSameOrigin(request)) return Response.json({ error: { code: "forbidden_origin", message: "Request origin is not allowed" } }, { status: 403 });
    const actor = await dependencies.authorize();
    if (!actor) return Response.json({ error: { code: "unauthorized", message: "Authentication required" } }, { status: 401 });
    try {
      const body = completeUploadSchema.parse(await request.json());
      return Response.json(await dependencies.completeUpload(actor, body));
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: { code: "invalid_upload_completion", message: "Invalid upload completion" } }, { status: 400 });
      if (error instanceof MediaDomainError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
      throw error;
    }
  };
}
