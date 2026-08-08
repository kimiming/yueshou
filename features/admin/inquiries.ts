import { z } from "zod";
import { EditorAuthorizationError, EditorValidationError, type AdminEditorActor } from "./editors";

const statuses = ["NEW", "IN_PROGRESS", "RESOLVED", "ARCHIVED"] as const;
type InquiryStatus = (typeof statuses)[number];
export type InquiryAdminRepository = { getStatus(inquiryId: string): Promise<InquiryStatus | null>; updateStatus(input: { inquiryId: string; status: InquiryStatus; internalNotes?: string | null; actorId: string }): Promise<void> };
const allowedTransitions: Record<InquiryStatus, readonly InquiryStatus[]> = { NEW: ["IN_PROGRESS", "ARCHIVED"], IN_PROGRESS: ["RESOLVED", "ARCHIVED"], RESOLVED: ["ARCHIVED"], ARCHIVED: [] };
function requireActor(actor: AdminEditorActor | null): asserts actor is AdminEditorActor { if (!actor) throw new EditorAuthorizationError("Authentication required"); }
export function createInquiryAdminService(dependencies: { repository: InquiryAdminRepository }) { return { async changeStatus(input: { actor: AdminEditorActor | null; inquiryId: string; status: InquiryStatus; internalNotes?: string | null }) { requireActor(input.actor); const data = z.object({ inquiryId: z.string().min(1), status: z.enum(statuses), internalNotes: z.string().trim().max(10_000).nullable().optional() }).parse(input); const current = await dependencies.repository.getStatus(data.inquiryId); if (!current) throw new EditorValidationError("Inquiry not found"); if (!allowedTransitions[current].includes(data.status)) throw new EditorValidationError("Invalid inquiry status transition"); await dependencies.repository.updateStatus({ ...data, actorId: input.actor.id }); } }; }
