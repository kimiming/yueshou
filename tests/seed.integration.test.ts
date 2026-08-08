import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, PublishStatus } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const execFileAsync = promisify(execFile);
const tsxCli = resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
const prisma = databaseUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
  : undefined;

afterAll(async () => {
  await prisma?.$disconnect();
});

describeWithDatabase("initial content seed", () => {
  it("enforces legal review before a legal page can publish", async () => {
    const slug = "legal-review-database-constraint";
    let pendingPublicationRejected = false;

    try {
      await prisma!.page.create({
        data: {
          slug,
          status: PublishStatus.PUBLISHED,
          legalReviewStatus: "PENDING",
        },
      });
    } catch {
      pendingPublicationRejected = true;
    }

    if (!pendingPublicationRejected) {
      await prisma!.page.delete({ where: { slug } });
    }

    expect(pendingPublicationRejected).toBe(true);

    const reviewedAt = new Date("2026-01-17T12:00:00.000Z");
    const approved = await prisma!.page.upsert({
      where: { slug },
      update: {
        status: PublishStatus.PUBLISHED,
        legalReviewStatus: "APPROVED",
        legalReviewedAt: reviewedAt,
      },
      create: {
        slug,
        status: PublishStatus.PUBLISHED,
        legalReviewStatus: "APPROVED",
        legalReviewedAt: reviewedAt,
      },
    });

    expect(approved.status).toBe(PublishStatus.PUBLISHED);
    expect(approved.legalReviewStatus).toBe("APPROVED");
    expect(approved.legalReviewedAt).toEqual(reviewedAt);
  });

  it("records a publication timestamp for published media", async () => {
    const publishedAt = new Date("2026-01-16T12:00:00.000Z");
    const media = await prisma!.mediaAsset.upsert({
      where: { storageKey: "test/seed-regression-media.txt" },
      update: { status: PublishStatus.PUBLISHED, publishedAt },
      create: {
        storageKey: "test/seed-regression-media.txt",
        filename: "seed-regression-media.txt",
        mimeType: "text/plain",
        sizeBytes: 1,
        status: PublishStatus.PUBLISHED,
        publishedAt,
      },
    });

    expect(media.publishedAt).toEqual(publishedAt);
  });

  it("preserves published counsel-reviewed legal content while creating missing legal rows", async () => {
    const reviewedAt = new Date("2026-01-15T12:00:00.000Z");
    const terms = await prisma!.page.upsert({
      where: { slug: "terms" },
      update: {
        status: PublishStatus.PUBLISHED,
        publishedAt: reviewedAt,
        legalReviewStatus: "APPROVED",
        legalReviewedAt: reviewedAt,
      },
      create: {
        slug: "terms",
        status: PublishStatus.PUBLISHED,
        publishedAt: reviewedAt,
        legalReviewStatus: "APPROVED",
        legalReviewedAt: reviewedAt,
      },
    });

    await prisma!.pageTranslation.upsert({
      where: { pageId_locale: { pageId: terms.id, locale: "en" } },
      update: { title: "Counsel-reviewed terms", body: "Reviewed legal content." },
      create: {
        pageId: terms.id,
        locale: "en",
        title: "Counsel-reviewed terms",
        body: "Reviewed legal content.",
      },
    });

    await execFileAsync(process.execPath, [tsxCli, "prisma/seed.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        INITIAL_ADMIN_EMAIL: "admin@example.test",
        INITIAL_ADMIN_PASSWORD: "correct-horse-battery-staple",
      },
    });

    const seededTerms = await prisma!.page.findUniqueOrThrow({
      where: { slug: "terms" },
      include: { translations: { where: { locale: "en" } } },
    });
    const cookiePolicy = await prisma!.page.findUniqueOrThrow({
      where: { slug: "cookie-policy" },
      include: { translations: true },
    });
    const legalPages = await prisma!.page.findMany({
      where: {
        slug: {
          in: ["terms", "privacy", "ruo-policy", "shipping-compliance", "cookie-policy"],
        },
      },
      select: { slug: true, legalReviewStatus: true },
    });
    expect(seededTerms.status).toBe(PublishStatus.PUBLISHED);
    expect(seededTerms.publishedAt).toEqual(reviewedAt);
    expect(seededTerms.translations[0]?.title).toBe("Counsel-reviewed terms");
    expect(seededTerms.legalReviewStatus).toBe("APPROVED");
    expect(seededTerms.legalReviewedAt).toEqual(reviewedAt);
    expect(cookiePolicy.translations).toHaveLength(5);
    expect(cookiePolicy.legalReviewStatus).toBe("PENDING");
    expect(legalPages).toEqual(
      expect.arrayContaining([
        { slug: "terms", legalReviewStatus: "APPROVED" },
        { slug: "privacy", legalReviewStatus: "PENDING" },
        { slug: "ruo-policy", legalReviewStatus: "PENDING" },
        { slug: "shipping-compliance", legalReviewStatus: "PENDING" },
        { slug: "cookie-policy", legalReviewStatus: "PENDING" },
      ]),
    );
  }, 20_000);
});
