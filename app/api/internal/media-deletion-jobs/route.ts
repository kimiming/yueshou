import { processDueMediaDeletionJobs } from "@/features/media/deletion-worker";
import { prismaMediaDeletionJobRepository } from "@/features/media/repository";
import { verifyCronRequest } from "@/features/admin/cron-auth";
import { parseEnv } from "@/lib/env";
import { createObjectStorage } from "@/lib/storage";

export const runtime = "nodejs";

async function processJobs() {
  const env = parseEnv(process.env);
  const result = await processDueMediaDeletionJobs({ repository: prismaMediaDeletionJobRepository, storage: createObjectStorage(env, env.STORAGE_BACKEND), limit: 25 });
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!verifyCronRequest({ secret: process.env.CRON_SECRET, timestamp: request.headers.get("x-cron-timestamp"), signature: request.headers.get("x-cron-signature") })) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  return processJobs();
}
