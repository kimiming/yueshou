import { describe, expect, it, vi } from "vitest";

import { validateSectionReferences } from "@/features/admin/section-references";

describe("page-section reference integrity", () => {
  it("rejects a forged or unavailable service reference", async () => {
    const repository = {
      countServices: vi.fn(async () => 1),
      countProductCategories: vi.fn(async () => 0),
      countHomepageItems: vi.fn(async () => 0),
    };
    await expect(validateSectionReferences(repository, { serviceIds: ["service-a", "deleted-service"] }, false))
      .rejects.toThrow(/service/i);
    expect(repository.countServices).toHaveBeenCalledWith(["service-a", "deleted-service"], false);
  });

  it("requires published referenced entities when editing a published page", async () => {
    const repository = {
      countServices: vi.fn(async () => 0),
      countProductCategories: vi.fn(async () => 1),
      countHomepageItems: vi.fn(async () => 0),
    };
    await expect(validateSectionReferences(repository, { categoryIds: ["category-a"] }, true)).resolves.toBeUndefined();
    expect(repository.countProductCategories).toHaveBeenCalledWith(["category-a"], true);
  });
});
