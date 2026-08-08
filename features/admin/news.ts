import { z } from "zod";

import { contentLocales } from "@/features/content/types";
import { EditorAuthorizationError, EditorValidationError, type AdminEditorActor } from "./editors";

const translationsSchema = z.array(z.object({ locale: z.enum(contentLocales), title: z.string().trim().min(1).max(160), body: z.string().trim().min(1), excerpt: z.string().trim().max(500).optional() })).min(1).max(contentLocales.length).superRefine((items, context) => { if (new Set(items.map((item) => item.locale)).size !== items.length) context.addIssue({ code: "custom", message: "Each locale may appear only once" }); });
const articleInputSchema = z.object({ id: z.string().min(1).optional(), version: z.string().datetime().nullable().optional(), categoryId: z.string().min(1), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), coverMediaId: z.string().min(1).nullable().optional(), tagIds: z.array(z.string().min(1)).max(30), scheduledAt: z.coerce.date().nullable().optional(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"), translations: translationsSchema });
export type NewsAdminInput = z.infer<typeof articleInputSchema>;
export type NewsAdminRepository = { saveArticle(input: NewsAdminInput & { actorId: string }): Promise<{ id: string; slug: string }>; countArticlesInCategory?(categoryId: string): Promise<number>; archiveCategory?(categoryId: string, actorId: string, version?: string): Promise<void>; countArticlesWithTag?(tagId: string): Promise<number>; archiveTag?(tagId: string, actorId: string, version?: string): Promise<void> };
function requireActor(actor: AdminEditorActor | null): asserts actor is AdminEditorActor { if (!actor) throw new EditorAuthorizationError("Authentication required"); }
function requireAdmin(actor: AdminEditorActor | null): asserts actor is AdminEditorActor & { role: "ADMIN" } { requireActor(actor); if (actor.role !== "ADMIN") throw new EditorAuthorizationError(); }

export function createNewsAdminService(dependencies: { repository: NewsAdminRepository; invalidate(type: "article", slug: string): void; now?: () => Date }) {
  return {
    async save(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor); const parsed = articleInputSchema.safeParse(input);
      if (!parsed.success) throw new EditorValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
      const article = parsed.data; const now = dependencies.now?.() ?? new Date();
      if (article.scheduledAt && article.scheduledAt <= now) throw new EditorValidationError("Scheduled publication must be in the future");
      if (article.status === "PUBLISHED" && article.scheduledAt) throw new EditorValidationError("Scheduled articles must remain drafts until the scheduler publishes them");
      if (article.status === "PUBLISHED" && !article.translations.some((item) => item.locale === "en")) throw new EditorValidationError("English translation is required before publishing");
      const result = await dependencies.repository.saveArticle({ ...article, actorId: input.actor.id }); if (article.status === "PUBLISHED") dependencies.invalidate("article", result.slug); return result;
    },
    async archiveCategory(input: { actor: AdminEditorActor | null; categoryId: string; version?: string }) {
      requireAdmin(input.actor); if (!dependencies.repository.countArticlesInCategory || !dependencies.repository.archiveCategory) throw new EditorValidationError("Category administration is unavailable");
      if (await dependencies.repository.countArticlesInCategory(input.categoryId)) throw new EditorValidationError("This category is referenced by articles and cannot be archived"); await dependencies.repository.archiveCategory(input.categoryId, input.actor.id, input.version);
    },
    async archiveTag(input: { actor: AdminEditorActor | null; tagId: string; version?: string }) {
      requireAdmin(input.actor); if (!dependencies.repository.countArticlesWithTag || !dependencies.repository.archiveTag) throw new EditorValidationError("Tag administration is unavailable");
      if (await dependencies.repository.countArticlesWithTag(input.tagId)) throw new EditorValidationError("This tag is referenced by articles and cannot be archived"); await dependencies.repository.archiveTag(input.tagId, input.actor.id, input.version);
    },
  };
}
