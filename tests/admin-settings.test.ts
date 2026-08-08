import { describe, expect, it, vi } from "vitest";

import {
  EditorAuthorizationError,
  EditorConflictError,
  createAdminEditorService,
  type AdminEditorRepository,
} from "@/features/admin/editors";

const admin = { id: "admin-1", role: "ADMIN" as const };
const editor = { id: "editor-1", role: "EDITOR" as const };

function repository(overrides: Partial<AdminEditorRepository> = {}): AdminEditorRepository {
  return {
    saveSiteSetting: vi.fn(async () => ({ id: "setting-1", version: "2026-08-08T00:00:01.000Z" })),
    saveNavigationItem: vi.fn(async () => ({ id: "nav-1", version: "2026-08-08T00:00:01.000Z" })),
    reorderNavigation: vi.fn(async () => undefined),
    getPageTranslations: vi.fn(async () => [{ locale: "en" as const, title: "About", body: "Research" }]),
    savePage: vi.fn(async () => ({ id: "page-1", slug: "about", version: "2026-08-08T00:00:01.000Z" })),
    savePageSection: vi.fn(async () => ({ id: "section-1", version: "2026-08-08T00:00:01.000Z" })),
    reorderPageSections: vi.fn(async () => undefined),
    changePageStatus: vi.fn(async () => ({ id: "page-1", slug: "about", publishedAt: new Date("2026-08-08T00:00:01.000Z") })),
    saveMediaMetadata: vi.fn(async () => ({ id: "media-1", version: "2026-08-08T00:00:01.000Z" })),
    archiveMedia: vi.fn(async () => ({ archived: true, retained: true, deleteAfter: null })),
    createAuditLog: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("site settings and navigation editors", () => {
  it("rejects an unauthenticated settings write", async () => {
    const service = createAdminEditorService({ repository: repository(), invalidate: vi.fn() });

    await expect(service.saveSiteSetting({ actor: null, key: "brand", version: null, value: {}, translations: [] }))
      .rejects.toBeInstanceOf(EditorAuthorizationError);
  });

  it("does not allow editors to manage destructive global settings", async () => {
    const repo = repository();
    const service = createAdminEditorService({ repository: repo, invalidate: vi.fn() });

    await expect(service.saveSiteSetting({
      actor: editor,
      key: "brand",
      version: null,
      value: { email: "research@yueshou.test" },
      translations: [{ locale: "en", title: "YueShou", body: "Precision peptides" }],
    })).rejects.toBeInstanceOf(EditorAuthorizationError);
    expect(repo.saveSiteSetting).not.toHaveBeenCalled();
  });

  it("rejects unsafe external navigation protocols before persistence", async () => {
    const repo = repository();
    const service = createAdminEditorService({ repository: repo, invalidate: vi.fn() });

    await expect(service.saveNavigationItem({
      actor: admin,
      id: "nav-1",
      slug: "unsafe",
      href: "javascript:alert(1)",
      parentId: null,
      position: 0,
      isVisible: true,
      version: "2026-08-08T00:00:00.000Z",
      translations: [{ locale: "en", title: "Unsafe" }],
    })).rejects.toThrow(/https, mailto, tel/i);
    expect(repo.saveNavigationItem).not.toHaveBeenCalled();
  });

  it("reports an optimistic-lock conflict without creating an audit record", async () => {
    const repo = repository({ saveSiteSetting: vi.fn(async () => null) });
    const service = createAdminEditorService({ repository: repo, invalidate: vi.fn() });

    await expect(service.saveSiteSetting({
      actor: admin,
      key: "brand",
      version: "2026-08-08T00:00:00.000Z",
      value: { email: "research@yueshou.test" },
      translations: [{ locale: "en", title: "YueShou", body: "Precision peptides" }],
    })).rejects.toBeInstanceOf(EditorConflictError);
    expect(repo.createAuditLog).not.toHaveBeenCalled();
  });
});
