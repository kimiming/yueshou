import { timingSafeEqual } from "node:crypto";

import { processDueMediaDeletionJobs } from "@/features/media/deletion-worker";
import { prismaMediaDeletionJobRepository } from "@/features/media/repository";
import { parseEnv } from "@/lib/env";
import { createObjectStorage } from "@/lib/storage";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || !token) return false;
  const expected = Buffer.from(secret); const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 404 });
  const env = parseEnv(process.env);
  const result = await processDueMediaDeletionJobs({ repository: prismaMediaDeletionJobRepository, storage: createObjectStorage(env, env.STORAGE_BACKEND) });
  return Response.json(result);
}
