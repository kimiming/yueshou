import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("ordinary fresh-deployment seed contract", () => {
  it("defines every editable public core page, four services, and the home section set", async () => {
    const source = await readFile(resolve(process.cwd(), "prisma", "seed.ts"), "utf8");

    expect(source).toContain("const corePages");
    for (const slug of ["home", "about", "services", "products", "quality", "news", "contact", "request-a-quote"]) {
      expect(source).toContain(`slug: "${slug}"`);
    }

    expect(source).toContain("const serviceSeeds");
    for (const slug of ["custom-peptide-synthesis", "peptide-modification", "analytical-support", "project-consultation"]) {
      expect(source).toContain(`slug: "${slug}"`);
    }

    expect(source).toContain("const homeSectionSeeds");
    for (const type of ["HERO", "SERVICES", "ABOUT", "FACTORY", "CAPABILITIES", "QUALITY", "STATS", "NEWS", "CTA"]) {
      expect(source).toContain(`type: PageSectionType.${type}`);
    }
  });

  it("uses explicit create-if-missing guards instead of editorial updates", async () => {
    const source = await readFile(resolve(process.cwd(), "prisma", "seed.ts"), "utf8");

    expect(source).toContain("seedCorePages");
    expect(source).toContain("seedServices");
    expect(source).toContain("seedHomeSections");
    expect(source).toContain("if (existingLegalPage) continue");
    expect(source).not.toContain("update: { href: item.href");
  });
});
