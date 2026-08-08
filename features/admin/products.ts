import { z } from "zod";

import { contentLocales } from "@/features/content/types";
import { EditorAuthorizationError, EditorValidationError, type AdminEditorActor } from "./editors";

const translationsSchema = z.array(z.object({ locale: z.enum(contentLocales), title: z.string().trim().min(1).max(160), body: z.string().trim().min(1) })).min(1).max(contentLocales.length).superRefine((items, context) => { if (new Set(items.map((item) => item.locale)).size !== items.length) context.addIssue({ code: "custom", message: "Each locale may appear only once" }); });
const productInputSchema = z.object({
  id: z.string().min(1).optional(), version: z.string().datetime().nullable().optional(), categoryId: z.string().min(1), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  casNumber: z.string().trim().optional().nullable(), sequence: z.string().trim().optional().nullable(), specifications: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"), scheduledAt: z.coerce.date().nullable().optional(), mediaIds: z.array(z.string().min(1)).max(20).default([]), translations: translationsSchema,
});
export type ProductAdminInput = z.infer<typeof productInputSchema>;
export type ProductAdminRepository = {
  saveProduct(input: ProductAdminInput & { actorId: string }): Promise<{ id: string; slug: string }>;
  countProductsInCategory?(categoryId: string): Promise<number>;
  archiveCategory?(categoryId: string, actorId: string): Promise<void>;
};

export function isValidCasNumber(value: string): boolean {
  const match = /^(\d{2,7})-(\d{2})-(\d)$/.exec(value);
  if (!match) return false;
  const digits = `${match[1]}${match[2]}`.split("").reverse();
  return digits.reduce((total, digit, index) => total + Number(digit) * (index + 1), 0) % 10 === Number(match[3]);
}

export function normalizePeptideSequence(value: string): string {
  const normalized = value.replace(/[\s-]/g, "").toUpperCase();
  if (!normalized || normalized.length > 10_000 || !/^[ACDEFGHIKLMNPQRSTVWY]+$/.test(normalized)) throw new EditorValidationError("Peptide sequence must contain only standard amino-acid one-letter codes");
  return normalized;
}

function requireActor(actor: AdminEditorActor | null): asserts actor is AdminEditorActor {
  if (!actor) throw new EditorAuthorizationError("Authentication required");
}
function requireAdmin(actor: AdminEditorActor | null): asserts actor is AdminEditorActor & { role: "ADMIN" } {
  requireActor(actor); if (actor.role !== "ADMIN") throw new EditorAuthorizationError();
}

export function createProductAdminService(dependencies: { repository: ProductAdminRepository; invalidate(type: "product", slug: string): void; now?: () => Date }) {
  return {
    async save(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const parsed = productInputSchema.safeParse(input);
      if (!parsed.success) throw new EditorValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
      const product = parsed.data;
      if (product.casNumber && !isValidCasNumber(product.casNumber)) throw new EditorValidationError("CAS number has an invalid check digit");
      if (product.sequence) product.sequence = normalizePeptideSequence(product.sequence);
      if (product.scheduledAt && product.scheduledAt <= (dependencies.now?.() ?? new Date())) throw new EditorValidationError("Scheduled publication must be in the future");
      if (product.scheduledAt && product.status !== "DRAFT") throw new EditorValidationError("Scheduled products must remain drafts until the scheduler publishes them");
      if (product.status === "PUBLISHED" && !product.translations.some((item) => item.locale === "en")) throw new EditorValidationError("English translation is required before publishing");
      const result = await dependencies.repository.saveProduct({ ...product, actorId: input.actor.id });
      if (product.status === "PUBLISHED") dependencies.invalidate("product", result.slug);
      return result;
    },
    async archiveCategory(input: { actor: AdminEditorActor | null; categoryId: string }) {
      requireAdmin(input.actor);
      if (!input.categoryId.trim()) throw new EditorValidationError("Category is required");
      if (!dependencies.repository.countProductsInCategory || !dependencies.repository.archiveCategory) throw new EditorValidationError("Category administration is unavailable");
      if (await dependencies.repository.countProductsInCategory(input.categoryId)) throw new EditorValidationError("This category is referenced by products and cannot be archived");
      await dependencies.repository.archiveCategory(input.categoryId, input.actor.id);
    },
  };
}
