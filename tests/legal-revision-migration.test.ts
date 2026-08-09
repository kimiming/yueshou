import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("legal content revision migration contract", () => {
  it("adds exact-review revision state and database invalidation triggers", async () => {
    const schema = await readFile(resolve(process.cwd(), "prisma", "schema.prisma"), "utf8");
    const migration = await readFile(resolve(
      process.cwd(),
      "prisma",
      "migrations",
      "20260809010000_legal_content_revisions",
      "migration.sql",
    ), "utf8");

    expect(schema).toContain("contentRevision");
    expect(schema).toContain("legalReviewedRevision");
    expect(schema).toContain("legalReviewedById");
    expect(migration).toContain('"legalReviewedRevision" = "contentRevision"');
    expect(migration).toContain("CREATE TRIGGER");
    expect(migration).toContain('ON "PageTranslation"');
    expect(migration).toContain('ON "PageSectionTranslation"');
    expect(migration).toContain('ON "PageSection"');
    expect(migration).toContain('"role" = \'ADMIN\'');
    expect(migration).toContain('"Page_enforce_admin_legal_reviewer"');
  });
});
