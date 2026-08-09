import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  E2E_BASELINE_HERO_STORAGE_KEY,
  E2E_BASELINE_LOGO_STORAGE_KEY,
  buildE2eSeedPlan,
} from "@/lib/e2e/seed-fixture";
import { inspectAndSanitizeImage } from "@/features/media/image-validation";

describe("deterministic post-reset E2E seed", () => {
  it("contains the complete public and mutation fixture under stable keys/slugs", () => {
    const plan = buildE2eSeedPlan();
    expect(plan.pages.map((page) => page.slug)).toEqual(expect.arrayContaining([
      "home", "about", "services", "products", "quality", "news", "contact", "request-a-quote",
    ]));
    expect(plan.services.length).toBeGreaterThanOrEqual(4);
    expect(plan.products).toEqual(expect.arrayContaining([expect.objectContaining({ slug: "e2e-research-peptide" })]));
    expect(plan.articles).toEqual(expect.arrayContaining([expect.objectContaining({ slug: "e2e-release-article" })]));
    expect(plan.legalPages).toHaveLength(5);
    expect(plan.storageObjects.map((item) => item.key)).toEqual(expect.arrayContaining([
      E2E_BASELINE_LOGO_STORAGE_KEY,
      E2E_BASELINE_HERO_STORAGE_KEY,
      "e2e/fixtures/logo.png",
      "e2e/fixtures/hero.png",
    ]));
  });

  it("uses genuinely decodable explicit image bytes with measured dimensions", async () => {
    for (const object of buildE2eSeedPlan().storageObjects) {
      const inspected = await inspectAndSanitizeImage({ bytes: object.body, declaredMimeType: "image/png" });
      expect(inspected.width).toBeGreaterThan(0);
      expect(inspected.height).toBeGreaterThan(0);
    }
  });

  it("wires the fail-closed release lifecycle to the dedicated seed script", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    expect(packageJson.scripts["db:seed:e2e"]).toBe("tsx prisma/e2e-seed.ts");
    expect(readFileSync("prisma/e2e-seed.ts", "utf8")).toContain("YUESHOU_E2E_RELEASE");
  });
});
