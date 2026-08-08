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
});
