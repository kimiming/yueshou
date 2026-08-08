import type { PrismaClient, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  createContentRepository,
  type PublicationRepository,
} from "@/features/content/repository";
import {
  LegalReviewRequiredError,
  publishEntity,
} from "@/features/publishing/actions";
import {
  contentTags,
  invalidatePublishedEntity,
} from "@/features/publishing/cache";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

describe("publication cache", () => {
  it.each([
    {
      type: "article" as const,
      slug: "lab-update",
      paths: [
        "/en/news/lab-update",
        "/zh-CN/news/lab-update",
        "/de/news/lab-update",
        "/fr/news/lab-update",
        "/es/news/lab-update",
      ],
      tags: ["article:lab-update", "article:list", "page:home"],
    },
    {
      type: "product" as const,
      slug: "bpc-157",
      paths: [
        "/en/products/bpc-157",
        "/zh-CN/products/bpc-157",
        "/de/products/bpc-157",
        "/fr/products/bpc-157",
        "/es/products/bpc-157",
      ],
      tags: ["product:bpc-157", "product:list", "page:home"],
    },
    {
      type: "page" as const,
      slug: "about",
      paths: [
        "/en/about",
        "/zh-CN/about",
        "/de/about",
        "/fr/about",
        "/es/about",
      ],
      tags: ["page:about", "page:list", "page:home"],
    },
  ])("invalidates deterministic $type paths, entity tags, and the home tag", ({
    type,
    slug,
    paths,
    tags,
  }) => {
    const revalidatePath = vi.fn();
    const revalidateTag = vi.fn();

    invalidatePublishedEntity(type, slug, SUPPORTED_LOCALES, {
      revalidatePath,
      revalidateTag,
    });

    expect(revalidatePath.mock.calls).toEqual(paths.map((path) => [path]));
    expect(revalidateTag.mock.calls).toEqual(tags.map((tag) => [tag, "max"]));
  });

  it("deduplicates localized paths and the page:home detail/home tag", () => {
    const revalidatePath = vi.fn();
    const revalidateTag = vi.fn();

    invalidatePublishedEntity("page", "home", [...SUPPORTED_LOCALES, "en"], {
      revalidatePath,
      revalidateTag,
    });

    expect(revalidatePath.mock.calls).toEqual([
      ["/en"],
      ["/zh-CN"],
      ["/de"],
      ["/fr"],
      ["/es"],
    ]);
    expect(revalidateTag.mock.calls).toEqual([
      ["page:home", "max"],
      ["page:list", "max"],
    ]);
  });

  it("keeps contentTags limited to entity detail and list tags", () => {
    expect(contentTags("product", "bpc-157")).toEqual([
      "product:bpc-157",
      "product:list",
    ]);
  });

  it("repository commits publication and its audit record atomically", async () => {
    const events: string[] = [];
    const now = new Date("2026-08-08T06:00:00.000Z");
    const transaction = {
      article: {
        updateMany: vi.fn(async () => {
          events.push("guard");
          return { count: 1 };
        }),
        update: vi.fn(async () => {
          events.push("update");
          return { id: "article-1", slug: "lab-update", publishedAt: now };
        }),
      },
      auditLog: {
        create: vi.fn(async () => {
          events.push("audit");
          return { id: "audit-1" };
        }),
      },
    } as unknown as Prisma.TransactionClient;
    const database = {
      $transaction: vi.fn(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        const result = await callback(transaction);
        events.push("commit");
        return result;
      }),
    } as unknown as PrismaClient;
    const repository = createContentRepository(database);

    const result = await repository.publishEntity(
      { type: "article", id: "article-1" },
      { id: "user-1" },
      now,
    );

    expect(result).toEqual({ id: "article-1", slug: "lab-update", publishedAt: now });
    expect(events).toEqual(["guard", "update", "audit", "commit"]);
    expect(transaction.article.updateMany).toHaveBeenCalledWith({
      where: { id: "article-1", publishedAt: null },
      data: { publishedAt: now },
    });
    expect(transaction.article.update).toHaveBeenCalledWith({
      where: { id: "article-1" },
      data: { status: "PUBLISHED" },
      select: { id: true, slug: true, publishedAt: true },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: "user-1",
        action: "PUBLISH",
        entityType: "article",
        entityId: "article-1",
        metadata: {
          slug: "lab-update",
          status: "PUBLISHED",
          publishedAt: "2026-08-08T06:00:00.000Z",
        },
      },
    });
  });

  it("preserves an article's explicit publication date when republishing", async () => {
    const existingPublishedAt = new Date("2026-07-01T05:00:00.000Z");
    const republishedAt = new Date("2026-08-08T06:00:00.000Z");
    const transaction = {
      article: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        update: vi.fn(async () => ({
          id: "article-1",
          slug: "lab-update",
          publishedAt: existingPublishedAt,
        })),
      },
      auditLog: { create: vi.fn(async () => ({ id: "audit-1" })) },
    } as unknown as Prisma.TransactionClient;
    const database = {
      $transaction: vi.fn((callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;

    const result = await createContentRepository(database).publishEntity(
      { type: "article", id: "article-1" },
      { id: "user-1" },
      republishedAt,
    );

    expect(transaction.article.updateMany).toHaveBeenCalledWith({
      where: { id: "article-1", publishedAt: null },
      data: { publishedAt: republishedAt },
    });
    expect(transaction.article.update).toHaveBeenCalledWith({
      where: { id: "article-1" },
      data: { status: "PUBLISHED" },
      select: { id: true, slug: true, publishedAt: true },
    });
    expect(result).toEqual({
      id: "article-1",
      slug: "lab-update",
      publishedAt: existingPublishedAt,
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          publishedAt: "2026-07-01T05:00:00.000Z",
        }),
      }),
    });
  });

  it("concurrent first-publish attempts converge on the first guarded timestamp", async () => {
    const firstTimestamp = new Date("2026-08-08T06:00:00.000Z");
    const secondTimestamp = new Date("2026-08-08T06:00:01.000Z");
    let storedPublishedAt: Date | null = null;
    const transaction = {
      article: {
        updateMany: vi.fn(async ({ data }: { data: { publishedAt: Date } }) => {
          if (storedPublishedAt === null) {
            storedPublishedAt = data.publishedAt;
            return { count: 1 };
          }
          return { count: 0 };
        }),
        update: vi.fn(async () => ({
          id: "article-1",
          slug: "lab-update",
          publishedAt: storedPublishedAt,
        })),
      },
      auditLog: { create: vi.fn(async () => ({ id: "audit-1" })) },
    } as unknown as Prisma.TransactionClient;
    const database = {
      $transaction: vi.fn((callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;
    const repository = createContentRepository(database);

    const [first, second] = await Promise.all([
      repository.publishEntity(
        { type: "article", id: "article-1" },
        { id: "user-1" },
        firstTimestamp,
      ),
      repository.publishEntity(
        { type: "article", id: "article-1" },
        { id: "user-2" },
        secondTimestamp,
      ),
    ]);

    expect(transaction.article.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "article-1", publishedAt: null },
      data: { publishedAt: firstTimestamp },
    });
    expect(transaction.article.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "article-1", publishedAt: null },
      data: { publishedAt: secondTimestamp },
    });
    expect(storedPublishedAt).toEqual(firstTimestamp);
    expect(first.publishedAt).toEqual(firstTimestamp);
    expect(second.publishedAt).toEqual(firstTimestamp);
  });

  it("invalidates only after the publication repository resolves", async () => {
    const events: string[] = [];
    const now = new Date("2026-08-08T06:00:00.000Z");
    const repository = {
      publishEntity: vi.fn(async () => {
        events.push("persist");
        return { id: "article-1", slug: "lab-update", publishedAt: now };
      }),
    } as PublicationRepository;
    const invalidate = vi.fn(() => events.push("invalidate"));

    const result = await publishEntity(
      { type: "article", id: "article-1" },
      { id: "user-1" },
      { repository, invalidate, now: () => now },
    );

    expect(result).toEqual({
      id: "article-1",
      slug: "lab-update",
      type: "article",
      status: "PUBLISHED",
      publishedAt: "2026-08-08T06:00:00.000Z",
    });
    expect(events).toEqual(["persist", "invalidate"]);
  });

  it("returns the repository-preserved publication date from the publication action", async () => {
    const existingPublishedAt = new Date("2026-07-01T05:00:00.000Z");
    const repository = {
      publishEntity: vi.fn(async () => ({
        id: "article-1",
        slug: "lab-update",
        publishedAt: existingPublishedAt,
      })),
    } as PublicationRepository;

    const result = await publishEntity(
      { type: "article", id: "article-1" },
      { id: "user-1" },
      {
        repository,
        invalidate: vi.fn(),
        now: () => new Date("2026-08-08T06:00:00.000Z"),
      },
    );

    expect(result.publishedAt).toBe("2026-07-01T05:00:00.000Z");
  });

  it("does not invalidate when the publication repository fails", async () => {
    const repository = {
      publishEntity: vi.fn(async () => {
        throw new Error("audit unavailable");
      }),
    } as PublicationRepository;
    const invalidate = vi.fn();

    await expect(
      publishEntity(
        { type: "product", id: "product-1" },
        { id: "user-1" },
        { repository, invalidate, now: () => new Date() },
      ),
    ).rejects.toThrow("audit unavailable");
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("repository surfaces an actionable error when a legal page is not approved", async () => {
    const transaction = {
      page: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: "page-terms",
          slug: "terms",
          legalReviewStatus: "PENDING",
          legalReviewedAt: null,
        })),
        update: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    } as unknown as Prisma.TransactionClient;
    const database = {
      $transaction: vi.fn((callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;
    const repository = createContentRepository(database);

    await expect(
      repository.publishEntity(
        { type: "page", id: "page-terms" },
        { id: "user-1" },
        new Date(),
      ),
    ).rejects.toBeInstanceOf(LegalReviewRequiredError);
    expect(transaction.page.update).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });
});
