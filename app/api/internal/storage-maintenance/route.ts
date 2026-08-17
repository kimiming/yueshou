import { verifyCronRequest } from "@/features/admin/cron-auth";
import { prismaStorageDeletionRepository } from "@/features/storage-cleanup/repository";
import { runStorageMaintenance } from "@/features/storage-cleanup/service";
import { parseEnv } from "@/lib/env";
import { createObjectStorage } from "@/lib/storage";

export const runtime = "nodejs";

async function processMaintenance() {
  const env = parseEnv(process.env);
  const result = await runStorageMaintenance({
    repository: prismaStorageDeletionRepository,
    storage: createObjectStorage(env, env.STORAGE_BACKEND),
    sweepLimit: 100,
    deletionLimit: 25,
  });
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!verifyCronRequest({
    secret: process.env.CRON_SECRET,
    timestamp: request.headers.get("x-cron-timestamp"),
    signature: request.headers.get("x-cron-signature"),
  })) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  return processMaintenance();
}
