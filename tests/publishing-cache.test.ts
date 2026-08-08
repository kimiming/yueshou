import type { PrismaClient, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

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
  it("invalidates exactly five localized detail paths and the entity tags", () => {
    const revalidatePath = vi.fn();
    const revalidateTag = vi.fn();

    invalidatePublishedEntity("article", "lab-update", SUPPORTED_LOCALES, {
      revalidatePath,
      revalidateTag,
    });

    expect(revalidatePath.mock.calls).toEqual([
      ["/en/news/lab-update"],
      ["/zh-CN/news/lab-update"],
      ["/de/news/lab-update"],
      ["/fr/news/lab-update"],
      ["/es/news/lab-update"],
    ]);
    expect(revalidateTag.mock.calls).toEqual([
      ["article:lab-update", "max"],
      ["article:list", "max"],
    ]);
    expect(contentTags("product", "bpc-157")).toEqual([
      "product:bpc-157",
      "product:list",
    ]);
  });

  it("commits publication and its audit record before invalidating", async () => {
    const events: string[] = [];
    const now = new Date("2026-08-08T06:00:00.000Z");
    const transaction = {
      article: {
        findUniqueOrThrow: vi.fn(async () => ({ id: "article-1", slug: "lab-update" })),
        update: vi.fn(async () => {
          events.push("update");
          return { id: "article-1", slug: "lab-update" };
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
    const invalidate = vi.fn(() => events.push("invalidate"));

    const result = await publishEntity(
      { type: "article", id: "article-1" },
      { id: "user-1" },
      { database, invalidate, now: () => now },
    );

    expect(result).toEqual({
      id: "article-1",
      slug: "lab-update",
      type: "article",
      status: "PUBLISHED",
      publishedAt: "2026-08-08T06:00:00.000Z",
    });
    expect(events).toEqual(["update", "audit", "commit", "invalidate"]);
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

  it("does not invalidate when the publication transaction fails", async () => {
    const database = {
      $transaction: vi.fn(async () => {
        throw new Error("audit unavailable");
      }),
    } as unknown as PrismaClient;
    const invalidate = vi.fn();

    await expect(
      publishEntity(
        { type: "product", id: "product-1" },
        { id: "user-1" },
        { database, invalidate, now: () => new Date() },
      ),
    ).rejects.toThrow("audit unavailable");
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("surfaces an actionable error when a legal page is not approved", async () => {
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
    const invalidate = vi.fn();

    await expect(
      publishEntity(
        { type: "page", id: "page-terms" },
        { id: "user-1" },
        { database, invalidate, now: () => new Date() },
      ),
    ).rejects.toBeInstanceOf(LegalReviewRequiredError);
    expect(transaction.page.update).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
