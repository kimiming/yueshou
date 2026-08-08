import { z } from "zod";

import { pageSectionSchema, translationSchema } from "@/features/content/schemas";
import { contentLocales, type ContentLocale } from "@/features/content/types";
import { validatePagePublication } from "./publication";

export type AdminEditorActor = { id: string; role: "ADMIN" | "EDITOR" };
export type EditorTranslation = z.infer<typeof translationSchema>;
export type AuditStamp = { actorId: string; action: string; entityType: string; entityId?: string; metadata?: Record<string, unknown> };

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

const brandValueSchema = z.object({
  logoMediaId: z.string().cuid().optional(),
  faviconMediaId: z.string().cuid().optional(),
  companyName: z.string().trim().min(1).max(160).optional(),
  slogan: z.string().trim().min(1).max(240).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  addressLines: z.array(z.string().trim().min(1).max(160)).max(6).optional(),
  socialLinks: z.array(z.object({ label: z.string().trim().min(1).max(80), href: z.string().trim().url().refine((href) => new URL(href).protocol === "https:", "Social links must use HTTPS") })).max(12).optional(),
  defaultSeo: z.object({ title: z.string().trim().min(1).max(160), description: z.string().trim().min(1).max(320), keywords: z.array(z.string().trim().min(1).max(80)).max(20).default([]) }).optional(),
  footerColumns: z.array(z.object({ heading: z.string().trim().min(1).max(80), links: z.array(z.object({ label: z.string().trim().min(1).max(80), href: safeNavigationHref })).max(12) })).max(6).optional(),
}).strict();

const settingInputSchema = z.object({
  key: z.literal("brand"),
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
  position: z.coerce.number().int().min(0),
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
  position: z.coerce.number().int().min(0),
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
  auditsMutations?: boolean;
  validatesPublicationAtomically?: boolean;
  validateBrandMedia?(mediaIds: string[]): Promise<boolean>;
  saveSiteSetting(input: z.infer<typeof settingInputSchema> & { audit?: AuditStamp }): Promise<{ id: string; version: string } | null>;
  saveNavigationItem(input: z.infer<typeof navigationInputSchema> & { audit?: AuditStamp }): Promise<{ id: string; version: string } | null>;
  isNavigationDescendant?(id: string, proposedParentId: string): Promise<boolean>;
  reorderNavigation(input: { orderedIds: string[]; audit?: AuditStamp }): Promise<void>;
  getPageTranslations(pageId: string): Promise<EditorTranslation[]>;
  isPagePublished?(pageId: string): Promise<boolean>;
  getPageForPublication?(pageId: string): Promise<{
    translations: EditorTranslation[];
    sections: Array<{ id: string; isEnabled: boolean; type: string; config: unknown; translations: EditorTranslation[] }>;
  } | null>;
  savePage(input: z.infer<typeof pageInputSchema> & { audit?: AuditStamp }): Promise<{ id: string; slug: string; version: string } | null>;
  savePageAndChangeStatus?(input: z.infer<typeof pageInputSchema> & { status: "PUBLISHED" | "ARCHIVED"; audit?: AuditStamp; statusAudit?: AuditStamp }): Promise<{ id: string; slug: string; publishedAt: Date | null; version: string } | null>;
  savePageSection(input: z.output<typeof pageSectionInputSchema> & { audit?: AuditStamp }): Promise<{ id: string; version: string } | null>;
  reorderPageSections(input: { pageId: string; orderedIds: string[]; audit?: AuditStamp }): Promise<void>;
  changePageStatus(input: { pageId: string; version: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; audit?: AuditStamp }): Promise<{
    id: string; slug: string; publishedAt: Date | null;
  } | null>;
  saveMediaMetadata(input: z.infer<typeof mediaInputSchema> & { audit?: AuditStamp }): Promise<{ id: string; version: string } | null>;
  getMediaTranslations?(mediaAssetId: string): Promise<Array<{ locale: ContentLocale; alt: string }>>;
  publishMedia?(input: { mediaAssetId: string; version: string; actorId: string }): Promise<{ id: string } | null>;
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

function validateSettingValue(key: string, value: Record<string, unknown>) {
  if (key === "brand") {
    const result = brandValueSchema.safeParse(value);
    if (!result.success) throw new EditorValidationError(result.error.issues.map((issue) => issue.message).join("; "));
    return result.data;
  }
  return value;
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
      payload.value = validateSettingValue(payload.key, payload.value);
      const mediaIds = [payload.value.logoMediaId, payload.value.faviconMediaId].filter((id): id is string => typeof id === "string");
      if (mediaIds.length && repository.validateBrandMedia && !(await repository.validateBrandMedia(mediaIds))) {
        throw new EditorValidationError("Brand media must be published, public, and available");
      }
      if (payload.status === "PUBLISHED") assertEnglish(payload.translations);
      const result = await repository.saveSiteSetting({ ...payload, audit: { actorId: input.actor.id, action: "SITE_SETTING_SAVED", entityType: "SiteSetting", metadata: { key: payload.key, status: payload.status } } });
      if (!result) throw new EditorConflictError();
      if (!repository.auditsMutations) await audit(repository, input.actor, "SITE_SETTING_SAVED", "SiteSetting", result.id, { key: payload.key, status: payload.status });
      return result;
    },

    async saveNavigationItem(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const payload = parse(navigationInputSchema, input);
      if (payload.id && payload.parentId === payload.id) throw new EditorValidationError("A navigation item cannot be its own parent");
      if (payload.status === "PUBLISHED" && !payload.translations.some((translation) => translation.locale === "en")) {
        throw new EditorValidationError("English translation is required before publishing");
      }
      const result = await repository.saveNavigationItem({ ...payload, audit: { actorId: input.actor.id, action: "NAVIGATION_SAVED", entityType: "NavigationItem", metadata: { slug: payload.slug, href: payload.href } } });
      if (!result) throw new EditorConflictError();
      if (!repository.auditsMutations) await audit(repository, input.actor, "NAVIGATION_SAVED", "NavigationItem", result.id, { slug: payload.slug, href: payload.href });
      return result;
    },

    async reorderNavigation(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const orderedIds = z.array(z.string().min(1)).min(1).max(100).parse(input.orderedIds);
      if (new Set(orderedIds).size !== orderedIds.length) throw new EditorValidationError("Navigation IDs must be unique");
      const entry = { actorId: input.actor.id, action: "NAVIGATION_REORDERED", entityType: "NavigationItem", entityId: "navigation", metadata: { orderedIds } };
      await repository.reorderNavigation({ orderedIds, audit: entry });
      if (!repository.auditsMutations) await repository.createAuditLog(entry);
    },

    async savePage(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const payload = parse(pageInputSchema, input);
      const result = await repository.savePage({ ...payload, audit: { actorId: input.actor.id, action: "PAGE_SAVED", entityType: "Page", metadata: { slug: payload.slug } } });
      if (!result) throw new EditorConflictError();
      if (!repository.auditsMutations) await audit(repository, input.actor, "PAGE_SAVED", "Page", result.id, { slug: result.slug });
      return result;
    },

    async savePageSection(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const payload = parse(pageSectionInputSchema, input);
      if (payload.isEnabled && await repository.isPagePublished?.(payload.pageId)) assertEnglish(payload.translations);
      const result = await repository.savePageSection({ ...payload, audit: { actorId: input.actor.id, action: "PAGE_SECTION_SAVED", entityType: "PageSection", metadata: { pageId: payload.pageId, type: payload.section.type } } });
      if (!result) throw new EditorConflictError();
      if (!repository.auditsMutations) await audit(repository, input.actor, "PAGE_SECTION_SAVED", "PageSection", result.id, { pageId: payload.pageId, type: payload.section.type });
      return result;
    },

    async reorderPageSections(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const parsed = z.object({ pageId: z.string().min(1), orderedIds: z.array(z.string().min(1)).min(1).max(100) }).parse(input);
      if (new Set(parsed.orderedIds).size !== parsed.orderedIds.length) throw new EditorValidationError("Section IDs must be unique");
      const entry = { actorId: input.actor.id, action: "PAGE_SECTIONS_REORDERED", entityType: "Page", entityId: parsed.pageId, metadata: { orderedIds: parsed.orderedIds } };
      await repository.reorderPageSections({ ...parsed, audit: entry });
      if (!repository.auditsMutations) await repository.createAuditLog(entry);
    },

    async setPageStatus(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const payload = z.object({ pageId: z.string().min(1), version: z.string().datetime(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) }).parse(input);
      if (payload.status === "ARCHIVED") requireAdmin(input.actor);
      if (payload.status === "PUBLISHED" && !repository.validatesPublicationAtomically) {
        const publication = await repository.getPageForPublication?.(payload.pageId);
        if (publication) validatePagePublication(publication);
        else assertEnglish(await repository.getPageTranslations(payload.pageId));
      }
      const action = payload.status === "PUBLISHED" ? "PUBLISH" : `PAGE_${payload.status}`;
      const entry = { actorId: input.actor.id, action, entityType: "page", metadata: { status: payload.status } };
      const result = await repository.changePageStatus({ ...payload, audit: entry });
      if (!result) throw new EditorConflictError();
      if (!repository.auditsMutations) await audit(repository, input.actor, action, "page", result.id, { slug: result.slug, status: payload.status });
      if (payload.status === "PUBLISHED") invalidate("page", result.slug);
      return { ...result, status: payload.status };
    },

    async savePageAndSetStatus(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const page = parse(pageInputSchema, input);
      if (!page.id || !page.version) throw new EditorValidationError("An existing page version is required");
      const status = z.enum(["PUBLISHED", "ARCHIVED"]).parse(input.status);
      if (status === "ARCHIVED") requireAdmin(input.actor);
      if (!repository.savePageAndChangeStatus) throw new EditorValidationError("Atomic page transition is not available");
      const result = await repository.savePageAndChangeStatus({
        ...page,
        status,
        audit: { actorId: input.actor.id, action: "PAGE_SAVED", entityType: "Page", metadata: { slug: page.slug } },
        statusAudit: { actorId: input.actor.id, action: status === "PUBLISHED" ? "PUBLISH" : "PAGE_ARCHIVED", entityType: "page", metadata: { status } },
      });
      if (!result) throw new EditorConflictError();
      if (!repository.auditsMutations) {
        await audit(repository, input.actor, "PAGE_SAVED", "Page", result.id, { slug: result.slug });
        await audit(repository, input.actor, status === "PUBLISHED" ? "PUBLISH" : "PAGE_ARCHIVED", "page", result.id, { slug: result.slug, status });
      }
      if (status === "PUBLISHED") invalidate("page", result.slug);
      return { ...result, status };
    },

    publishPage(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      return this.setPageStatus({ ...input, status: "PUBLISHED" });
    },

    async saveMediaMetadata(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const payload = parse(mediaInputSchema, input);
      const english = payload.translations.find((translation) => translation.locale === "en");
      if (!english?.alt) throw new EditorValidationError("English alt text is required for media");
      const result = await repository.saveMediaMetadata({ ...payload, audit: { actorId: input.actor.id, action: "MEDIA_METADATA_SAVED", entityType: "MediaAsset" } });
      if (!result) throw new EditorConflictError();
      if (!repository.auditsMutations) await audit(repository, input.actor, "MEDIA_METADATA_SAVED", "MediaAsset", result.id);
      return result;
    },

    async archiveMedia(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireAdmin(input.actor);
      const mediaAssetId = z.string().min(1).parse(input.mediaAssetId);
      const result = await repository.archiveMedia({ actor: input.actor, mediaAssetId });
      await audit(repository, input.actor, "MEDIA_ARCHIVED", "MediaAsset", mediaAssetId, { retained: result.retained, deleteAfter: result.deleteAfter?.toISOString() ?? null });
      return result;
    },

    async publishMedia(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const payload = z.object({ mediaAssetId: z.string().min(1), version: z.string().datetime() }).parse(input);
      if (!repository.getMediaTranslations || !repository.publishMedia) throw new EditorValidationError("Media publication is not available");
      const english = (await repository.getMediaTranslations(payload.mediaAssetId)).find((translation) => translation.locale === "en");
      if (!english?.alt.trim()) throw new EditorValidationError("English alt text is required before publishing media");
      const result = await repository.publishMedia({ ...payload, actorId: input.actor.id });
      if (!result) throw new EditorConflictError();
      if (!repository.auditsMutations) await audit(repository, input.actor, "PUBLISH", "MediaAsset", result.id);
      return result;
    },
  };
}

export { contentLocales, type ContentLocale };
