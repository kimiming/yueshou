"use server";

import { revalidatePath } from "next/cache";
import { prismaInquiryAdminRepository } from "@/features/admin/domain-repository";
import { createInquiryAdminService } from "@/features/admin/inquiries";
import { requireUser } from "@/lib/auth/permissions";

const data = (input: unknown) => input instanceof FormData ? JSON.parse(String(input.get("payload") ?? "{}")) as object : input as object;
export async function changeInquiryStatusAction(input: unknown) { const actor = await requireUser(); const payload = data(input) as { inquiryId: string; status: "NEW" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED" }; await createInquiryAdminService({ repository: prismaInquiryAdminRepository }).changeStatus({ ...payload, actor }); revalidatePath("/admin/inquiries"); }
export async function saveInquiryNotesAction(input: unknown) { const actor = await requireUser(); const payload = data(input) as { inquiryId: string; internalNotes: string | null }; await createInquiryAdminService({ repository: prismaInquiryAdminRepository }).saveNotes({ ...payload, actor }); revalidatePath("/admin/inquiries"); }
