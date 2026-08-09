import { describe, expect, it, vi } from "vitest";

import {
  createServiceAdminService,
  type ServiceAdminRepository,
} from "@/features/admin/services";

const editor = { id: "editor-1", role: "EDITOR" as const };
const admin = { id: "admin-1", role: "ADMIN" as const };

function repository(overrides: Partial<ServiceAdminRepository> = {}): ServiceAdminRepository {
  return {
    saveService: vi.fn(async () => ({
      id: "service-1",
      slug: "custom-synthesis",
      status: "DRAFT" as const,
      version: "2026-08-09T00:00:01.000Z",
    })),
    ...overrides,
  };
}

describe("Service CMS lifecycle", () => {
  it("creates a draft and requires English before publishing", async () => {
    const repo = repository();
    const service = createServiceAdminService({ repository: repo, invalidate: vi.fn() });

    await expect(service.save({
      actor: editor,
      slug: "custom-synthesis",
      status: "DRAFT",
      position: 10,
      translations: [{ locale: "de", title: "Synthese", body: "Forschung" }],
    })).resolves.toMatchObject({ id: "service-1" });
    await expect(service.save({
      actor: editor,
      slug: "custom-synthesis",
      status: "PUBLISHED",
      position: 10,
      translations: [{ locale: "de", title: "Synthese", body: "Forschung" }],
    })).rejects.toThrow(/English/i);
  });

  it("carries a version CAS and invalidates detail/list dependencies after publication", async () => {
    const repo = repository({
      saveService: vi.fn(async () => ({
        id: "service-1",
        slug: "custom-synthesis",
        status: "PUBLISHED" as const,
        version: "2026-08-09T00:00:01.000Z",
      })),
    });
    const invalidate = vi.fn();
    const service = createServiceAdminService({ repository: repo, invalidate });

    await service.save({
      actor: editor,
      id: "service-1",
      version: "2026-08-09T00:00:00.000Z",
      slug: "custom-synthesis",
      status: "PUBLISHED",
      position: 10,
      translations: [{ locale: "en", title: "Custom synthesis", body: "Research service" }],
    });

    expect(repo.saveService).toHaveBeenCalledWith(expect.objectContaining({
      id: "service-1",
      version: "2026-08-09T00:00:00.000Z",
      actorId: editor.id,
    }));
    expect(invalidate).toHaveBeenCalledWith("custom-synthesis");
  });

  it("invalidates both the previous and current detail paths after a slug change", async () => {
    const repo = repository({
      saveService: vi.fn(async () => ({
        id: "service-1",
        previousSlug: "legacy-synthesis",
        slug: "custom-synthesis",
        status: "PUBLISHED" as const,
        version: "2026-08-09T00:00:01.000Z",
      })),
    });
    const invalidate = vi.fn();
    const service = createServiceAdminService({ repository: repo, invalidate });

    await service.save({
      actor: editor,
      id: "service-1",
      version: "2026-08-09T00:00:00.000Z",
      slug: "custom-synthesis",
      status: "PUBLISHED",
      position: 10,
      translations: [{ locale: "en", title: "Custom synthesis", body: "Research service" }],
    });

    expect(invalidate).toHaveBeenCalledWith("legacy-synthesis");
    expect(invalidate).toHaveBeenCalledWith("custom-synthesis");
  });

  it("allows only administrators to archive a service", async () => {
    const repo = repository();
    const service = createServiceAdminService({ repository: repo, invalidate: vi.fn() });
    const input = {
      id: "service-1",
      version: "2026-08-09T00:00:00.000Z",
      slug: "custom-synthesis",
      status: "ARCHIVED",
      position: 10,
      translations: [{ locale: "en", title: "Custom synthesis", body: "Research service" }],
    } as const;

    await expect(service.save({ actor: editor, ...input })).rejects.toThrow(/Administrator/i);
    await expect(service.save({ actor: admin, ...input })).resolves.toMatchObject({ id: "service-1" });
  });
});
