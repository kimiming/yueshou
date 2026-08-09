import { z } from "zod";

import { contentLocales } from "@/features/content/types";
import {
  EditorAuthorizationError,
  EditorValidationError,
  type AdminEditorActor,
} from "./editors";

const translationsSchema = z.array(z.object({
  locale: z.enum(contentLocales),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1),
})).min(1).max(contentLocales.length).superRefine((items, context) => {
  if (new Set(items.map((item) => item.locale)).size !== items.length) {
    context.addIssue({ code: "custom", message: "Each locale may appear only once" });
  }
});

const serviceInputSchema = z.object({
  id: z.string().min(1).optional(),
  version: z.string().datetime().optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  position: z.number().int().min(0).max(10_000).default(0),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  translations: translationsSchema,
}).superRefine((value, context) => {
  if (value.id && !value.version) context.addIssue({ code: "custom", path: ["version"], message: "version is required when editing a service" });
  if (!value.id && value.version) context.addIssue({ code: "custom", path: ["version"], message: "version is valid only when editing a service" });
  if (!value.id && value.status === "ARCHIVED") context.addIssue({ code: "custom", path: ["status"], message: "A new service cannot start archived" });
});

export type ServiceAdminInput = z.infer<typeof serviceInputSchema>;
export type ServiceAdminResult = {
  id: string;
  previousSlug?: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: string;
};
export interface ServiceAdminRepository {
  saveService(input: ServiceAdminInput & { actorId: string }): Promise<ServiceAdminResult>;
}

function requireActor(actor: AdminEditorActor | null): asserts actor is AdminEditorActor {
  if (!actor) throw new EditorAuthorizationError("Authentication required");
}

export function createServiceAdminService(dependencies: {
  repository: ServiceAdminRepository;
  invalidate(slug: string): void | Promise<void>;
}) {
  return {
    async save(input: { actor: AdminEditorActor | null } & Record<string, unknown>) {
      requireActor(input.actor);
      const parsed = serviceInputSchema.safeParse(input);
      if (!parsed.success) throw new EditorValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
      if (parsed.data.status === "ARCHIVED" && input.actor.role !== "ADMIN") {
        throw new EditorAuthorizationError("Administrator role required to archive a service");
      }
      if (parsed.data.status === "PUBLISHED" && !parsed.data.translations.some((translation) => translation.locale === "en")) {
        throw new EditorValidationError("English translation is required before publishing");
      }
      const result = await dependencies.repository.saveService({ ...parsed.data, actorId: input.actor.id });
      if (result.previousSlug && result.previousSlug !== result.slug) {
        await dependencies.invalidate(result.previousSlug);
      }
      await dependencies.invalidate(result.slug);
      return result;
    },
  };
}
