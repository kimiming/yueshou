import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("rejects a production configuration without a database URL", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        AUTH_SECRET: "12345678901234567890123456789012",
      }),
    ).toThrow("DATABASE_URL");
  });

  it("requires a deployment proxy model and dedicated inquiry hashing secret", () => {
    const base = {
      NODE_ENV: "production", DATABASE_URL: "postgresql://db.test/app", AUTH_SECRET: "12345678901234567890123456789012",
      STORAGE_ENDPOINT: "https://objects.test", STORAGE_REGION: "auto", STORAGE_BUCKET: "private", STORAGE_ACCESS_KEY_ID: "key", STORAGE_SECRET_ACCESS_KEY: "secret", NEXT_PUBLIC_SITE_URL: "https://site.test",
    };
    expect(() => parseEnv(base)).toThrow("INQUIRY_HASH_SECRET");
    expect(() => parseEnv({ ...base, INQUIRY_HASH_SECRET: "12345678901234567890123456789012", INQUIRY_PROXY_MODE: "unknown" })).toThrow("INQUIRY_PROXY_MODE");
    expect(parseEnv({ ...base, INQUIRY_HASH_SECRET: "12345678901234567890123456789012", INQUIRY_PROXY_MODE: "direct" }).INQUIRY_PROXY_MODE).toBe("direct");
  });
});
