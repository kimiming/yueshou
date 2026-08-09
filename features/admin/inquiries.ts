import { z } from "zod";

import {
  EditorAuthorizationError,
  EditorConflictError,
  EditorValidationError,
  type AdminEditorActor,
} from "./editors";

const statuses = ["NEW", "IN_PROGRESS", "RESOLVED", "ARCHIVED"] as const;
type InquiryStatus = (typeof statuses)[number];
type VersionedInquiry = { version: string };

export type InquiryAdminRepository = {
  getStatus(inquiryId: string): Promise<({ status: InquiryStatus } & VersionedInquiry) | null>;
  updateStatus(input: { inquiryId: string; expectedStatus: InquiryStatus; status: InquiryStatus; version: string; actorId: string }): Promise<VersionedInquiry | null>;
  saveNotes?(input: { inquiryId: string; internalNotes: string | null; version: string; actorId: string }): Promise<VersionedInquiry | null>;
};

const allowedTransitions: Record<InquiryStatus, readonly InquiryStatus[]> = {
  NEW: ["IN_PROGRESS", "ARCHIVED"],
  IN_PROGRESS: ["RESOLVED", "ARCHIVED"],
  RESOLVED: ["ARCHIVED"],
  ARCHIVED: [],
};

function requireActor(actor: AdminEditorActor | null): asserts actor is AdminEditorActor {
  if (!actor) throw new EditorAuthorizationError("Authentication required");
}

const versionSchema = z.string().datetime();

export function createInquiryAdminService(dependencies: { repository: InquiryAdminRepository }) {
  return {
    async changeStatus(input: { actor: AdminEditorActor | null; inquiryId: string; status: InquiryStatus; version: string }) {
      requireActor(input.actor);
      const data = z.object({ inquiryId: z.string().min(1), status: z.enum(statuses), version: versionSchema }).parse(input);
      const current = await dependencies.repository.getStatus(data.inquiryId);
      if (!current) throw new EditorValidationError("Inquiry not found");
      if (!allowedTransitions[current.status].includes(data.status)) throw new EditorValidationError("Invalid inquiry status transition");
      const result = await dependencies.repository.updateStatus({
        ...data,
        expectedStatus: current.status,
        actorId: input.actor.id,
      });
      if (!result) throw new EditorConflictError();
      return result;
    },

    async saveNotes(input: { actor: AdminEditorActor | null; inquiryId: string; internalNotes: string | null; version: string }) {
      requireActor(input.actor);
      const data = z.object({
        inquiryId: z.string().min(1),
        internalNotes: z.string().trim().max(10_000).nullable(),
        version: versionSchema,
      }).parse(input);
      const result = await dependencies.repository.saveNotes?.({ ...data, actorId: input.actor.id });
      if (!result) throw new EditorConflictError();
      return result;
    },
  };
}
