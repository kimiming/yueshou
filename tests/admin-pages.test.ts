import { describe, expect, it, vi } from "vitest";

import {
  EditorValidationError,
  createAdminEditorService,
  type AdminEditorRepository,
} from "@/features/admin/editors";
import { validatePagePublication } from "@/features/admin/publication";

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

describe("page section editor", () => {
  it("rejects publishing when an enabled section lacks an English translation", () => {
    expect(() => validatePagePublication({
      translations: [{ locale: "en", title: "About", body: "Research" }],
      sections: [{ id: "section-1", isEnabled: true, type: "about", config: {}, translations: [{ locale: "de", title: "Über", body: "Text" }] }],
    })).toThrow(/English translation/i);
  });
  it("requires a complete English page translation before publishing", async () => {
    const repo = repository({ getPageTranslations: vi.fn(async () => [{ locale: "de" as const, title: "Über", body: "Text" }]) });
    const service = createAdminEditorService({ repository: repo, invalidate: vi.fn() });

    await expect(service.publishPage({ actor: editor, pageId: "page-1", version: "2026-08-08T00:00:00.000Z" }))
      .rejects.toBeInstanceOf(EditorValidationError);
    expect(repo.changePageStatus).not.toHaveBeenCalled();
  });

  it("rejects page-section types outside the approved catalogue", async () => {
    const repo = repository();
    const service = createAdminEditorService({ repository: repo, invalidate: vi.fn() });

    await expect(service.savePageSection({
      actor: editor,
      id: "section-1",
      pageId: "page-1",
      type: "tracking-pixel",
      config: {},
      position: 0,
      isEnabled: true,
      version: "2026-08-08T00:00:00.000Z",
      translations: [{ locale: "en", title: "Heading", body: "Copy" }],
    })).rejects.toThrow();
    expect(repo.savePageSection).not.toHaveBeenCalled();
  });

  it("writes audit data and invalidates published cache only after publication succeeds", async () => {
    const repo = repository();
    const invalidate = vi.fn();
    const service = createAdminEditorService({ repository: repo, invalidate });

    await expect(service.publishPage({ actor: editor, pageId: "page-1", version: "2026-08-08T00:00:00.000Z" }))
      .resolves.toMatchObject({ status: "PUBLISHED", slug: "about" });
    expect(repo.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actorId: editor.id,
      action: "PUBLISH",
      entityType: "page",
      entityId: "page-1",
    }));
    expect(invalidate).toHaveBeenCalledWith("page", "about");
  });

  it("passes publication audit data to transactional repositories", async () => {
    const repo = repository({ auditsMutations: true });
    const service = createAdminEditorService({ repository: repo, invalidate: vi.fn() });

    await service.publishPage({ actor: editor, pageId: "page-1", version: "2026-08-08T00:00:00.000Z" });

    expect(repo.changePageStatus).toHaveBeenCalledWith(expect.objectContaining({
      pageId: "page-1",
      audit: expect.objectContaining({ actorId: editor.id, action: "PUBLISH", entityType: "page" }),
    }));
    expect(repo.createAuditLog).not.toHaveBeenCalled();
  });

  it("uses the media safe-delete state rather than physically deleting assets", async () => {
    const repo = repository();
    const service = createAdminEditorService({ repository: repo, invalidate: vi.fn() });

    await expect(service.archiveMedia({ actor: admin, mediaAssetId: "media-1" })).resolves.toEqual({
      archived: true,
      retained: true,
      deleteAfter: null,
    });
    expect(repo.archiveMedia).toHaveBeenCalledWith({ actor: admin, mediaAssetId: "media-1" });
  });

  it("preserves localized SEO fields when saving a page", async () => {
    const repo = repository();
    const service = createAdminEditorService({ repository: repo, invalidate: vi.fn() });

    await service.savePage({ actor: editor, id: "page-1", slug: "about", version: "2026-08-08T00:00:00.000Z", translations: [{ locale: "en", title: "About", body: "Research", seoTitle: "About peptide research", seoDescription: "Peptide research capabilities" }] });

    expect(repo.savePage).toHaveBeenCalledWith(expect.objectContaining({ translations: [expect.objectContaining({ seoTitle: "About peptide research", seoDescription: "Peptide research capabilities" })] }));
  });

  it("rejects duplicate locale rows before a page write", async () => {
    const repo = repository();
    const service = createAdminEditorService({ repository: repo, invalidate: vi.fn() });

    await expect(service.savePage({ actor: editor, id: "page-1", slug: "about", version: "2026-08-08T00:00:00.000Z", translations: [{ locale: "en", title: "About", body: "Research" }, { locale: "en", title: "About again", body: "Research" }] })).rejects.toBeInstanceOf(EditorValidationError);
    expect(repo.savePage).not.toHaveBeenCalled();
  });
});
