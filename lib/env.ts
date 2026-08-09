import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  INQUIRY_HASH_SECRET: z.string().min(32),
  INQUIRY_PROXY_MODE: z.enum(["vercel", "nginx", "direct"]),
  STORAGE_BACKEND: z.enum(["r2", "minio"]).default("r2"),
  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_INTERNAL_ENDPOINT: z.string().url().optional(),
  STORAGE_REGION: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
}).superRefine((env, context) => {
  if (env.NODE_ENV === "production" && env.INQUIRY_PROXY_MODE === "direct") {
    context.addIssue({
      code: "custom",
      path: ["INQUIRY_PROXY_MODE"],
      message: "INQUIRY_PROXY_MODE must be vercel or nginx in production",
    });
  }
});

export type AppEnv = z.infer<typeof schema>;
export const parseEnv = (input: Record<string, string | undefined>): AppEnv => schema.parse(input);
