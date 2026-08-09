import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const upgradeDatabaseUrl = process.env.UPGRADE_DATABASE_URL;
const describeUpgrade = upgradeDatabaseUrl ? describe : describe.skip;
const pool = upgradeDatabaseUrl ? new Pool({ connectionString: upgradeDatabaseUrl }) : undefined;

const migrationPath = (...parts: string[]) =>
  resolve(process.cwd(), "prisma", "migrations", ...parts, "migration.sql");

const executeMigration = async (...parts: string[]) => {
  const sql = await readFile(migrationPath(...parts), "utf8");
  await pool!.query(sql);
};

describeUpgrade("legal review guard upgrade", () => {
  beforeAll(async () => {
    await pool!.query('DROP SCHEMA IF EXISTS "public" CASCADE; CREATE SCHEMA "public";');
    await executeMigration("20260808045410_init");
    await executeMigration("20260808051000_legal_review_and_media_publication");

    await pool!.query(`
      INSERT INTO "Page" ("id", "slug", "status", "publishedAt", "legalReviewStatus", "legalReviewedAt", "createdAt", "updatedAt")
      VALUES
        ('legacy-invalid', 'legacy-invalid', 'PUBLISHED', NOW(), 'PENDING', NULL, NOW(), NOW()),
        ('legacy-approved', 'legacy-approved', 'PUBLISHED', NOW(), 'APPROVED', NOW(), NOW(), NOW()),
        ('legacy-non-legal', 'legacy-non-legal', 'PUBLISHED', NOW(), 'NOT_REQUIRED', NULL, NOW(), NOW());
    `);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("demotes legacy invalid publications before enforcing the legal review check", async () => {
    await executeMigration("20260808052000_enforce_legal_review_before_publication");

    const pages = await pool!.query<{
      slug: string;
      status: string;
      publishedAt: Date | null;
      legalReviewStatus: string;
      legalReviewedAt: Date | null;
    }>(`
      SELECT "slug", "status", "publishedAt", "legalReviewStatus", "legalReviewedAt"
      FROM "Page"
      WHERE "slug" IN ('legacy-invalid', 'legacy-approved', 'legacy-non-legal')
      ORDER BY "slug";
    `);

    expect(pages.rows).toEqual([
      {
        slug: "legacy-approved",
        status: "PUBLISHED",
        publishedAt: expect.any(Date),
        legalReviewStatus: "APPROVED",
        legalReviewedAt: expect.any(Date),
      },
      {
        slug: "legacy-invalid",
        status: "DRAFT",
        publishedAt: null,
        legalReviewStatus: "PENDING",
        legalReviewedAt: null,
      },
      {
        slug: "legacy-non-legal",
        status: "PUBLISHED",
        publishedAt: expect.any(Date),
        legalReviewStatus: "NOT_REQUIRED",
        legalReviewedAt: null,
      },
    ]);

    await expect(
      pool!.query(`
        INSERT INTO "Page" ("id", "slug", "status", "legalReviewStatus", "createdAt", "updatedAt")
        VALUES ('future-invalid', 'future-invalid', 'PUBLISHED', 'PENDING', NOW(), NOW());
      `),
    ).rejects.toThrow();
  }, 20_000);

  it("fails historic approvals closed and invalidates the exact approved revision on child edits", async () => {
    await executeMigration("20260809010000_legal_content_revisions");

    const migrated = await pool!.query<{
      slug: string;
      status: string;
      contentRevision: number;
      legalReviewedRevision: number | null;
    }>(`
      SELECT "slug", "status", "contentRevision", "legalReviewedRevision"
      FROM "Page"
      WHERE "slug" IN ('legacy-approved', 'legacy-non-legal')
      ORDER BY "slug";
    `);
    expect(migrated.rows).toEqual([
      { slug: "legacy-approved", status: "DRAFT", contentRevision: 2, legalReviewedRevision: null },
      { slug: "legacy-non-legal", status: "PUBLISHED", contentRevision: 1, legalReviewedRevision: null },
    ]);

    await pool!.query(`
      INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt", "updatedAt")
      VALUES
        ('legal-admin', 'legal-admin@example.test', 'unused', 'ADMIN', NOW(), NOW()),
        ('legal-editor', 'legal-editor@example.test', 'unused', 'EDITOR', NOW(), NOW());
      INSERT INTO "PageTranslation" ("id", "pageId", "locale", "title", "body")
      VALUES ('legal-copy', 'legacy-approved', 'en', 'Legal', 'Reviewed copy');
    `);
    const current = await pool!.query<{ contentRevision: number }>(`
      SELECT "contentRevision" FROM "Page" WHERE "id" = 'legacy-approved';
    `);
    const approvedRevision = current.rows[0]!.contentRevision;
    await expect(pool!.query(`
      UPDATE "Page"
      SET "legalReviewStatus" = 'APPROVED',
          "legalReviewedAt" = NOW(),
          "legalReviewedRevision" = $1,
          "legalReviewedById" = 'legal-editor'
      WHERE "id" = 'legacy-approved';
    `, [approvedRevision])).rejects.toThrow();
    await pool!.query(`
      UPDATE "Page"
      SET "legalReviewStatus" = 'APPROVED',
          "legalReviewedAt" = NOW(),
          "legalReviewedRevision" = $1,
          "legalReviewedById" = 'legal-admin',
          "status" = 'PUBLISHED',
          "publishedAt" = NOW()
      WHERE "id" = 'legacy-approved';
    `, [approvedRevision]);

    await pool!.query(`UPDATE "PageTranslation" SET "body" = 'Changed after approval' WHERE "id" = 'legal-copy';`);
    const invalidated = await pool!.query<{
      status: string;
      publishedAt: Date | null;
      contentRevision: number;
      legalReviewStatus: string;
      legalReviewedAt: Date | null;
      legalReviewedRevision: number | null;
      legalReviewedById: string | null;
    }>(`
      SELECT "status", "publishedAt", "contentRevision", "legalReviewStatus", "legalReviewedAt", "legalReviewedRevision", "legalReviewedById"
      FROM "Page" WHERE "id" = 'legacy-approved';
    `);
    expect(invalidated.rows[0]).toEqual({
      status: "DRAFT",
      publishedAt: null,
      contentRevision: approvedRevision + 1,
      legalReviewStatus: "PENDING",
      legalReviewedAt: null,
      legalReviewedRevision: null,
      legalReviewedById: null,
    });
  }, 20_000);
});
