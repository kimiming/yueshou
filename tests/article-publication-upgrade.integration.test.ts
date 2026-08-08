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

describeUpgrade("article publication timestamp upgrade", () => {
  beforeAll(async () => {
    await pool!.query('DROP SCHEMA IF EXISTS "public" CASCADE; CREATE SCHEMA "public";');
    await executeMigration("20260808045410_init");

    await pool!.query(`
      INSERT INTO "User" ("id", "email", "passwordHash", "createdAt", "updatedAt")
      VALUES ('author-1', 'author@example.test', 'not-used', NOW(), NOW());
      INSERT INTO "ArticleCategory" ("id", "slug", "status", "createdAt", "updatedAt")
      VALUES ('category-1', 'research', 'PUBLISHED', NOW(), NOW());
      INSERT INTO "Article" ("id", "categoryId", "authorId", "slug", "status", "publishedAt", "createdAt", "updatedAt")
      VALUES
        ('legacy-invalid', 'category-1', 'author-1', 'legacy-invalid', 'PUBLISHED', NULL, NOW(), NOW()),
        ('legacy-valid', 'category-1', 'author-1', 'legacy-valid', 'PUBLISHED', '2026-07-01T05:00:00.000Z', NOW(), NOW()),
        ('legacy-draft', 'category-1', 'author-1', 'legacy-draft', 'DRAFT', NULL, NOW(), NOW());
    `);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("demotes invalid legacy rows, preserves controls, and rejects future invalid publication", async () => {
    await executeMigration("20260808170000_enforce_article_published_at");

    const articles = await pool!.query<{
      slug: string;
      status: string;
      publishedAt: Date | null;
    }>(`
      SELECT "slug", "status", "publishedAt"
      FROM "Article"
      WHERE "slug" LIKE 'legacy-%'
      ORDER BY "slug";
    `);

    expect(articles.rows).toEqual([
      { slug: "legacy-draft", status: "DRAFT", publishedAt: null },
      { slug: "legacy-invalid", status: "DRAFT", publishedAt: null },
      {
        slug: "legacy-valid",
        status: "PUBLISHED",
        publishedAt: new Date("2026-07-01T05:00:00.000Z"),
      },
    ]);

    await expect(
      pool!.query(`
        INSERT INTO "Article" ("id", "categoryId", "authorId", "slug", "status", "publishedAt", "createdAt", "updatedAt")
        VALUES ('future-invalid', 'category-1', 'author-1', 'future-invalid', 'PUBLISHED', NULL, NOW(), NOW());
      `),
    ).rejects.toThrow();

    await expect(
      pool!.query(`
        INSERT INTO "Article" ("id", "categoryId", "authorId", "slug", "status", "publishedAt", "createdAt", "updatedAt")
        VALUES ('future-valid', 'category-1', 'author-1', 'future-valid', 'PUBLISHED', NOW(), NOW(), NOW());
      `),
    ).resolves.toBeDefined();
  }, 20_000);
});
