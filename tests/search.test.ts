import { describe, expect, it, vi } from "vitest";

import {
  createContentSearch,
  escapeLikePattern,
  normalizeSearchQuery,
} from "@/features/content/search";

const translation = (title: string, body: string) => [
  { locale: "en", title, body },
];

function createDatabase() {
  const emptyFindMany = () =>
    vi.fn<(args: unknown) => Promise<unknown[]>>().mockResolvedValue([]);
  return {
    product: { findMany: emptyFindMany() },
    service: { findMany: emptyFindMany() },
    page: { findMany: emptyFindMany() },
    article: { findMany: emptyFindMany() },
  };
}

describe("content search", () => {
  it("normalizes Unicode whitespace and limits input to 100 characters", () => {
    expect(normalizeSearchQuery("  αβ\u3000  γ  ")).toBe("αβ γ");
    expect(normalizeSearchQuery("界".repeat(101))).toHaveLength(100);
  });

  it("escapes PostgreSQL LIKE wildcard characters and backslashes", () => {
    expect(escapeLikePattern("50%_\\pure")).toBe("50\\%\\_\\\\pure");
  });

  it("matches product name, CAS, sequence, and application and ranks deterministically", async () => {
    const database = createDatabase();
    database.product.findMany.mockResolvedValue([
      {
        id: "p-name",
        slug: "alpha",
        casNumber: null,
        sequence: null,
        translations: translation("Alpha peptide", "Catalog entry"),
      },
      {
        id: "p-cas",
        slug: "cas-result",
        casNumber: "Alpha-123",
        sequence: null,
        translations: translation("Reference peptide", "Catalog entry"),
      },
      {
        id: "p-sequence",
        slug: "sequence-result",
        casNumber: null,
        sequence: "GGALPHAGG",
        translations: translation("Sequence peptide", "Catalog entry"),
      },
      {
        id: "p-application",
        slug: "application-result",
        casNumber: null,
        sequence: null,
        translations: translation("Application peptide", "Used in alpha screening applications"),
      },
    ]);
    const search = createContentSearch(database as never);

    const results = await search("en", "alpha");

    expect(results.map(({ id }) => id)).toEqual([
      "p-name",
      "p-cas",
      "p-sequence",
      "p-application",
    ]);
    expect(results).toHaveLength(4);
    expect(results.every((result) => result.type === "product")).toBe(true);
  });

  it("uses published, non-deleted, locale-scoped parameterized Prisma filters", async () => {
    const database = createDatabase();
    const search = createContentSearch(database as never);

    await search("en", "%_\\");

    const query = database.product.findMany.mock.calls[0]?.[0];
    expect(query).toMatchObject({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        category: { is: { status: "PUBLISHED", deletedAt: null } },
        OR: expect.arrayContaining([
          { casNumber: { contains: "\\%\\_\\\\", mode: "insensitive" } },
          { sequence: { contains: "\\%\\_\\\\", mode: "insensitive" } },
          {
            translations: {
              some: {
                locale: "en",
                OR: expect.arrayContaining([
                  { title: { contains: "\\%\\_\\\\", mode: "insensitive" } },
                  { body: { contains: "\\%\\_\\\\", mode: "insensitive" } },
                ]),
              },
            },
          },
        ]),
      },
      take: 30,
    });
  });

  it("caps combined results at 30 with stable relevance, type, title, and id ordering", async () => {
    const database = createDatabase();
    database.page.findMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({
        id: `page-${String(index).padStart(2, "0")}`,
        slug: `page-${index}`,
        translations: translation("Needle page", "Needle"),
      })),
    );
    database.service.findMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({
        id: `service-${String(index).padStart(2, "0")}`,
        slug: `service-${index}`,
        translations: translation("Needle service", "Needle"),
      })),
    );
    const search = createContentSearch(database as never);

    const results = await search("en", "needle");

    expect(results).toHaveLength(30);
    expect(results.slice(0, 3).map(({ id }) => id)).toEqual([
      "page-00",
      "page-01",
      "page-02",
    ]);
  });

  it("returns no results and performs no query for blank input", async () => {
    const database = createDatabase();
    const search = createContentSearch(database as never);

    await expect(search("en", " \u3000 ")).resolves.toEqual([]);
    expect(database.product.findMany).not.toHaveBeenCalled();
  });
});
