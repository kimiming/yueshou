import { describe, expect, it } from "vitest";

import { createProductAdminService } from "@/features/admin/products";

describe("product administration", () => {
  it("rejects a CAS number with an invalid check digit before a product write", async () => {
    const service = createProductAdminService({
      repository: { saveProduct: async () => ({ id: "product-1", slug: "test" }) },
      invalidate: () => undefined,
    });

    await expect(service.save({
      actor: { id: "editor-1", role: "EDITOR" },
      categoryId: "category-1", slug: "test", casNumber: "50-00-1", sequence: "ACDE",
      translations: [{ locale: "en", title: "Test peptide", body: "Research product" }],
    })).rejects.toThrow("CAS");
  });

  it("rejects non-amino-acid symbols in a peptide sequence", async () => {
    const service = createProductAdminService({
      repository: { saveProduct: async () => ({ id: "product-1", slug: "test" }) },
      invalidate: () => undefined,
    });

    await expect(service.save({
      actor: { id: "editor-1", role: "EDITOR" },
      categoryId: "category-1", slug: "test", casNumber: "50-00-0", sequence: "ACD*",
      translations: [{ locale: "en", title: "Test peptide", body: "Research product" }],
    })).rejects.toThrow("sequence");
  });

  it("prevents deleting a category that is still referenced by products", async () => {
    const service = createProductAdminService({
      repository: {
        saveProduct: async () => ({ id: "product-1", slug: "test" }),
        countProductsInCategory: async () => 1,
        archiveCategory: async () => undefined,
      },
      invalidate: () => undefined,
    });

    await expect(service.archiveCategory({ actor: { id: "admin-1", role: "ADMIN" }, categoryId: "category-1" }))
      .rejects.toThrow("referenced");
  });

  it("rejects duplicate locales before a product write", async () => {
    const service = createProductAdminService({ repository: { saveProduct: async () => ({ id: "product-1", slug: "test" }) }, invalidate: () => undefined });
    await expect(service.save({ actor: { id: "editor-1", role: "EDITOR" }, categoryId: "category-1", slug: "test", translations: [
      { locale: "en", title: "One", body: "Research" }, { locale: "en", title: "Two", body: "Research" },
    ] })).rejects.toThrow("locale");
  });
});
