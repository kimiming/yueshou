import { z } from "zod";

import { pageSectionSchema, translationSchema } from "@/features/content/schemas";
import { contentLocales, type ContentLocale } from "@/features/content/types";

export type AdminEditorActor = { id: string; role: "ADMIN" | "EDITOR" };
export type EditorTranslation = z.infer<typeof translationSchema>;

export class EditorAuthorizationError extends Error {
  constructor(message = "Administrator access is required") {
    super(message);
    this.name = "EditorAuthorizationError";
  }
}

export class EditorConflictError extends Error {
  constructor() {
    super("This content was changed by another user. Reload and try again.");
    this.name = "EditorConflictError";
  }
}

export class EditorValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorValidationError";
  }
}

const versionSchema = z.string().datetime().nullable();
const localeTitleSchema = z.object({
  locale: z.enum(contentLocales),
  title: z.string().trim().min(1).max(160),
});

const safeNavigationHref = z.string().trim().superRefine((value, context) => {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return;
  try {
    const url = new URL(value);
    if (["https:", "mailto:", "tel:"].includes(url.protocol) && !url.username && !url.password) return;
  } catch {
    // Surface a single actionable allow-list message below.
  }
  context.addIssue({ code: "custom", message: "Navigation links must use a relative URL, https, mailto, tel" });
});

const settingInputSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9-]{0,63}$/),
  version: versionSchema,
  value: z.record(z.string(), z.unknown()),
  translations: z.array(translationSchema).max(contentLocales.length),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});

const navigationInputSchema = z.object({
  id: z.string().min(1).optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  href: safeNavigationHref,
  parentId: z.string().min(1).nullable(),
  position: z.number().int().min(0),
  isVisible: z.boolean(),
  version: versionSchema,
  translations: z.array(localeTitleSchema).min(1).max(contentLocales.length),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});

const pageInputSchema = z.object({
  id: z.string().min(1).optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  version: versionSchema,
  translations: z.array(translationSchema).max(contentLocales.length),
});

const pageSectionInputSchema = z.object({
  id: z.string().min(1).optional(),
  pageId: z.string().min(1),
  type: z.string(),
  config: z.unknown(),
  position: z.number().int().min(0),
  isEnabled: z.boolean(),
  version: versionSchema,
  translations: z.array(translationSchema).max(contentLocales.length),
}).transform((input, context) => {
  const section = pageSectionSchema.safeParse({ type: input.type, config: input.config });
  if (!section.success) {
    for (const issue of section.error.issues) context.addIssue({ code: "custom", message: issue.message, path: issue.path });
    return z.NEVER;
  }
  return { ...input, section: section.data };
});

const mediaInputSchema = z.object({
  id: z.string().min(1),
  version: versionSchema,
  translations: z.array(z.object({
    locale: z.enum(contentLocales),
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().max(4_000).default(""),
    alt: z.string().trim().min(1).max(250),
  })).max(contentLocales.length),
});

export type AdminEditorRepository = {
  saveSiteSetting(input: z.infer<typeof settingInputSchema>): Promise<{ id: string; version: string } | null>;
  saveNavigationItem(input: z.infer<typeof navigationInputSchema>): Promise<{ id: string; version: string } | null>;
  reorderNavigation(input: { orderedIds: string[]; actorId: string }): Promise<void>;
  getPageTranslations(pageId: string): Promise<EditorTranslation[]>;
  savePage(input: z.infer<typeof pageInputSchema>): Promise<{ id: string; slug: string; version: string } | null>;
  savePageSection(input: z.output<typeof pageSectionInputSchema>): Promise<{ id: string; version: string } | null>;
  reorderPageSections(input: { pageId: string; orderedIds: string[]; actorId: string }): Promise<void>;
  changePageStatus(input: { pageId: string; version: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }): Promise<{
    id: string; slug: string; publishedAt: Date | null;
  } | null>;
  saveMediaMetadata(input: z.infer<typeof mediaInputSchema>): Promise<{ id: string; version: string } | null>;
  archiveMedia(input: { actor: AdminEditorActor; mediaAssetId: string }): Promise<{ archived: boolean; retained: boolean; deleteAfter: Date | null }>;
  createAuditLog(input: { actorId: string; action: string; entityType: string; entityId: string; metadata?: Record<string, unknown> }): Promise<void>;
};

function requireActor(actor: AdminEditorActor | null): asserts actor is AdminEditorActor {
  if (!actor) throw new EditorAuthorizationError("Authentication required");
}

function requireAdmin(actor: AdminEditorActor | null): asserts actor is AdminEditorActor & { role: "ADMIN" } {
  requireActor(actor);
  if (actor.role !== "ADMIN") throw new EditorAuthorizationError();
}

function assertEnglish(translations: readonly EditorTranslation[]) {
  if (!translations.some((translation) => translation.locale === "en" && translation.title.trim() && translation.body.trim())) {
    throw new EditorValidationError("English translation is required before publishing");
  }
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new EditorValidationError(result.error.issues.map((issue) => issue.message).join("; "));
  return result.data;
}

async function audit(repository: AdminEditorRepository, actor: AdminEditorActor, action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) {
  await repository.createAuditLog({ actorId: actor.id, action, entityType, entityId, metadata });
}

export function createAdminEditorService(dependencies: {
  repository: AdminEditorRepository;
  invalidate(type: "page", slug: string): void;
}) {
  const { repository, invalidate } = dependencies;
  return {
    async saveSiteSetting(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireAdmin(input.actor);
      const payload = parse(settingInputSchema, input);
      if (payload.status === "PUBLISHED") assertEnglish(payload.translations);
      const result = await repository.saveSiteSetting(payload);
      if (!result) throw new EditorConflictError();
      await audit(repository, input.actor, "SITE_SETTING_SAVED", "SiteSetting", result.id, { key: payload.key, status: payload.status });
      return result;
    },

    async saveNavigationItem(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const payload = parse(navigationInputSchema, input);
      if (payload.status === "PUBLISHED" && !payload.translations.some((translation) => translation.locale === "en")) {
        throw new EditorValidationError("English translation is required before publishing");
      }
      const result = await repository.saveNavigationItem(payload);
      if (!result) throw new EditorConflictError();
      await audit(repository, input.actor, "NAVIGATION_SAVED", "NavigationItem", result.id, { slug: payload.slug, href: payload.href });
      return result;
    },

    async reorderNavigation(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const orderedIds = z.array(z.string().min(1)).min(1).max(100).parse(input.orderedIds);
      if (new Set(orderedIds).size !== orderedIds.length) throw new EditorValidationError("Navigation IDs must be unique");
      await repository.reorderNavigation({ orderedIds, actorId: input.actor.id });
      await audit(repository, input.actor, "NAVIGATION_REORDERED", "NavigationItem", "navigation", { orderedIds });
    },

    async savePage(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const payload = parse(pageInputSchema, input);
      const result = await repository.savePage(payload);
      if (!result) throw new EditorConflictError();
      await audit(repository, input.actor, "PAGE_SAVED", "Page", result.id, { slug: result.slug });
      return result;
    },

    async savePageSection(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const payload = parse(pageSectionInputSchema, input);
      const result = await repository.savePageSection(payload);
      if (!result) throw new EditorConflictError();
      await audit(repository, input.actor, "PAGE_SECTION_SAVED", "PageSection", result.id, { pageId: payload.pageId, type: payload.section.type });
      return result;
    },

    async reorderPageSections(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const parsed = z.object({ pageId: z.string().min(1), orderedIds: z.array(z.string().min(1)).min(1).max(100) }).parse(input);
      if (new Set(parsed.orderedIds).size !== parsed.orderedIds.length) throw new EditorValidationError("Section IDs must be unique");
      await repository.reorderPageSections({ ...parsed, actorId: input.actor.id });
      await audit(repository, input.actor, "PAGE_SECTIONS_REORDERED", "Page", parsed.pageId, { orderedIds: parsed.orderedIds });
    },

    async setPageStatus(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const payload = z.object({ pageId: z.string().min(1), version: z.string().datetime(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) }).parse(input);
      if (payload.status === "PUBLISHED") assertEnglish(await repository.getPageTranslations(payload.pageId));
      const result = await repository.changePageStatus(payload);
      if (!result) throw new EditorConflictError();
      await audit(repository, input.actor, payload.status === "PUBLISHED" ? "PUBLISH" : `PAGE_${payload.status}`, "page", result.id, { slug: result.slug, status: payload.status });
      if (payload.status === "PUBLISHED") invalidate("page", result.slug);
      return { ...result, status: payload.status };
    },

    publishPage(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      return this.setPageStatus({ ...input, status: "PUBLISHED" });
    },

    async saveMediaMetadata(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const payload = parse(mediaInputSchema, input);
      const english = payload.translations.find((translation) => translation.locale === "en");
      if (!english?.alt) throw new EditorValidationError("English alt text is required for media");
      const result = await repository.saveMediaMetadata(payload);
      if (!result) throw new EditorConflictError();
      await audit(repository, input.actor, "MEDIA_METADATA_SAVED", "MediaAsset", result.id);
      return result;
    },

    async archiveMedia(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireAdmin(input.actor);
      const mediaAssetId = z.string().min(1).parse(input.mediaAssetId);
      const result = await repository.archiveMedia({ actor: input.actor, mediaAssetId });
      await audit(repository, input.actor, "MEDIA_ARCHIVED", "MediaAsset", mediaAssetId, { retained: result.retained, deleteAfter: result.deleteAfter?.toISOString() ?? null });
      return result;
    },
  };
}

export { contentLocales, type ContentLocale };
