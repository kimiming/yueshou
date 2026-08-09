import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findUnique,
  invalidatePublishedEntity,
  savePageSection,
} = vi.hoisted(() => ({
  findUnique: vi.fn(),
  invalidatePublishedEntity: vi.fn(),
  savePageSection: vi.fn(async () => ({ id: "section-1", version: "2026-08-08T00:00:01.000Z" })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/permissions", () => ({ requireUser: vi.fn(async () => ({ id: "editor-1", role: "EDITOR" })) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { page: { findUnique } } }));
vi.mock("@/features/publishing/cache", () => ({ invalidatePublishedEntity }));
vi.mock("@/features/admin/repository", () => ({ prismaAdminEditorRepository: {} }));
vi.mock("@/features/admin/editors", () => ({ createAdminEditorService: () => ({ savePageSection }) }));

import { savePageSectionAction } from "@/app/admin/(dashboard)/pages/[id]/actions";

describe("page editor actions", () => {
  beforeEach(() => {
    findUnique.mockReset();
    invalidatePublishedEntity.mockReset();
    savePageSection.mockClear();
  });

  it("evicts the former public slug when a legal child edit demotes the page", async () => {
    findUnique.mockImplementation(async () => savePageSection.mock.calls.length
      ? { slug: "terms", status: "DRAFT" }
      : { slug: "terms", status: "PUBLISHED" });

    await savePageSectionAction({
      id: "section-1",
      pageId: "page-terms",
      version: "2026-08-08T00:00:00.000Z",
      position: 0,
      type: "about",
      config: {},
      isEnabled: true,
      translations: [{ locale: "en", title: "Terms", body: "Changed terms" }],
    });

    expect(savePageSection).toHaveBeenCalledOnce();
    expect(invalidatePublishedEntity).toHaveBeenCalledWith("page", "terms", expect.any(Array));
  });
});
