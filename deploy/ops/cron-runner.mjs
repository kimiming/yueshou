import { createHmac } from "node:crypto";

const secret = process.env.CRON_SECRET;
const baseUrl = process.env.INTERNAL_APP_URL ?? "http://web:3000";

if (!secret || secret.length < 32) throw new Error("CRON_SECRET must be set to a 32+ character secret");
if (!/^http:\/\/web:3000$/.test(baseUrl)) throw new Error("INTERNAL_APP_URL must be the private web service URL");

async function invoke(path) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}.`).digest("hex");
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "x-cron-timestamp": timestamp, "x-cron-signature": signature },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
}

await invoke("/api/internal/publish-scheduled");
await invoke("/api/internal/media-deletion-jobs");
