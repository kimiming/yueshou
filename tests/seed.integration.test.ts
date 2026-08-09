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
  const runSeed = () => execFileAsync(process.execPath, [tsxCli, "prisma/seed.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });

  it("enforces legal review before a legal page can publish", async () => {
    const slug = "legal-review-database-constraint";
    await prisma!.page.deleteMany({ where: { slug } });
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

    const reviewer = await prisma!.user.upsert({
      where: { email: "seed-constraint-reviewer@example.test" },
      update: { role: "ADMIN", isActive: true, deletedAt: null },
      create: { email: "seed-constraint-reviewer@example.test", passwordHash: "unused", role: "ADMIN" },
    });
    const pending = await prisma!.page.create({
      data: {
        slug,
        status: PublishStatus.DRAFT,
        legalReviewStatus: "PENDING",
      },
    });
    const reviewedAt = new Date("2026-01-17T12:00:00.000Z");
    const approved = await prisma!.page.update({
      where: { id: pending.id },
      data: {
        status: PublishStatus.PUBLISHED,
        legalReviewStatus: "APPROVED",
        legalReviewedAt: reviewedAt,
        legalReviewedRevision: pending.contentRevision,
        legalReviewedById: reviewer.id,
      },
    });

    expect(approved.status).toBe(PublishStatus.PUBLISHED);
    expect(approved.legalReviewStatus).toBe("APPROVED");
    expect(approved.legalReviewedAt).toEqual(reviewedAt);
    expect(approved.legalReviewedRevision).toBe(pending.contentRevision);
    expect(approved.legalReviewedById).toBe(reviewer.id);
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
    await runSeed();
    const reviewer = await prisma!.user.upsert({
      where: { email: "seed-legal-reviewer@example.test" },
      update: { role: "ADMIN", isActive: true, deletedAt: null },
      create: { email: "seed-legal-reviewer@example.test", passwordHash: "unused", role: "ADMIN" },
    });
    const reviewedAt = new Date("2026-01-15T12:00:00.000Z");
    const terms = await prisma!.page.findUniqueOrThrow({ where: { slug: "terms" } });

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
    const currentTerms = await prisma!.page.findUniqueOrThrow({ where: { id: terms.id } });
    await prisma!.page.update({
      where: { id: terms.id },
      data: {
        status: PublishStatus.PUBLISHED,
        publishedAt: reviewedAt,
        legalReviewStatus: "APPROVED",
        legalReviewedAt: reviewedAt,
        legalReviewedRevision: currentTerms.contentRevision,
        legalReviewedById: reviewer.id,
      },
    });

    await runSeed();

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
    expect(seededTerms.legalReviewedRevision).toBe(seededTerms.contentRevision);
    expect(seededTerms.legalReviewedById).toBe(reviewer.id);
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

  it("creates a complete editable public baseline and preserves editorial changes on rerun", async () => {
    await runSeed();

    const pages = await prisma!.page.findMany({
      where: { slug: { in: ["home", "about", "services", "products", "quality", "news", "contact", "request-a-quote"] } },
      include: { translations: true },
    });
    expect(pages).toHaveLength(8);
    expect(pages.every((page) => page.status === PublishStatus.PUBLISHED && page.translations.length === 5)).toBe(true);

    const services = await prisma!.service.findMany({
      where: { slug: { in: ["custom-peptide-synthesis", "peptide-modification", "analytical-support", "project-consultation"] } },
      include: { translations: true },
      orderBy: { position: "asc" },
    });
    expect(services).toHaveLength(4);
    expect(services.every((service) => service.status === PublishStatus.PUBLISHED && service.translations.length === 5)).toBe(true);

    const home = pages.find((page) => page.slug === "home")!;
    const sections = await prisma!.pageSection.findMany({
      where: { pageId: home.id, deletedAt: null },
      include: { translations: true },
    });
    expect(sections.map((section) => section.type)).toEqual(expect.arrayContaining([
      "HERO", "SERVICES", "ABOUT", "CAPABILITIES", "QUALITY", "STATS", "NEWS", "CTA",
    ]));
    expect(sections.every((section) => section.status === PublishStatus.PUBLISHED && section.translations.length === 5)).toBe(true);
    const servicesSection = sections.find((section) => section.type === "SERVICES")!;
    expect((servicesSection.config as { serviceIds?: string[] }).serviceIds).toEqual(services.map((service) => service.id));

    const about = pages.find((page) => page.slug === "about")!;
    const hero = sections.find((section) => section.type === "HERO")!;
    await prisma!.$transaction([
      prisma!.pageTranslation.update({
        where: { pageId_locale: { pageId: about.id, locale: "en" } },
        data: { title: "Editor-owned About" },
      }),
      prisma!.serviceTranslation.update({
        where: { serviceId_locale: { serviceId: services[0]!.id, locale: "en" } },
        data: { title: "Editor-owned Service" },
      }),
      prisma!.pageSection.update({
        where: { id: hero.id },
        data: { config: { primaryCta: { label: "Editor CTA", href: "/contact" } } },
      }),
      prisma!.pageSectionTranslation.update({
        where: { pageSectionId_locale: { pageSectionId: hero.id, locale: "en" } },
        data: { title: "Editor-owned Hero" },
      }),
    ]);

    await runSeed();

    await expect(prisma!.pageTranslation.findUniqueOrThrow({ where: { pageId_locale: { pageId: about.id, locale: "en" } } }))
      .resolves.toMatchObject({ title: "Editor-owned About" });
    await expect(prisma!.serviceTranslation.findUniqueOrThrow({ where: { serviceId_locale: { serviceId: services[0]!.id, locale: "en" } } }))
      .resolves.toMatchObject({ title: "Editor-owned Service" });
    await expect(prisma!.pageSection.findUniqueOrThrow({ where: { id: hero.id } }))
      .resolves.toMatchObject({ config: { primaryCta: { label: "Editor CTA", href: "/contact" } } });
    await expect(prisma!.pageSectionTranslation.findUniqueOrThrow({ where: { pageSectionId_locale: { pageSectionId: hero.id, locale: "en" } } }))
      .resolves.toMatchObject({ title: "Editor-owned Hero" });
  }, 30_000);
});
