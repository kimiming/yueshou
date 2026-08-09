import { describe, expect, it } from "vitest";

import { createNewsAdminService } from "@/features/admin/news";

describe("news administration", () => {
  it("rejects a scheduled date that is not in the future", async () => {
    const service = createNewsAdminService({
      repository: { saveArticle: async () => ({ id: "article-1", slug: "news" }) },
      invalidate: () => undefined,
      now: () => new Date("2026-08-08T00:00:00.000Z"),
    });

    await expect(service.save({
      actor: { id: "editor-1", role: "EDITOR" }, categoryId: "category-1", slug: "news",
      scheduledAt: "2026-08-07T23:59:59.000Z",
      translations: [{ locale: "en", title: "News", body: "Research update" }], tagIds: [],
    })).rejects.toThrow("future");
  });

  it("requires administrator access to archive a referenced article category", async () => {
    const service = createNewsAdminService({
      repository: { saveArticle: async () => ({ id: "article-1", slug: "news" }), countArticlesInCategory: async () => 0, archiveCategory: async () => undefined },
      invalidate: () => undefined,
    });

    await expect(service.archiveCategory({ actor: { id: "editor-1", role: "EDITOR" }, categoryId: "category-1", version: "2026-08-08T00:00:00.000Z" }))
      .rejects.toThrow("Administrator");
  });

  it("rejects duplicate article translation locales", async () => {
    const service = createNewsAdminService({ repository: { saveArticle: async () => ({ id: "article-1", slug: "news" }) }, invalidate: () => undefined });
    await expect(service.save({ actor: { id: "editor-1", role: "EDITOR" }, categoryId: "category-1", slug: "news", tagIds: [], translations: [
      { locale: "en", title: "One", body: "Research" }, { locale: "en", title: "Two", body: "Research" },
    ] })).rejects.toThrow("locale");
  });

  it("requires a draft for a future article schedule", async () => {
    const service = createNewsAdminService({ repository: { saveArticle: async () => ({ id: "article-1", slug: "news" }) }, invalidate: () => undefined, now: () => new Date("2026-08-08T00:00:00.000Z") });
    await expect(service.save({ actor: { id: "editor-1", role: "EDITOR" }, categoryId: "category-1", slug: "news", tagIds: [], status: "PUBLISHED", scheduledAt: "2026-08-09T00:00:00.000Z", translations: [{ locale: "en", title: "News", body: "Research" }] })).rejects.toThrow("draft");
  });
});
