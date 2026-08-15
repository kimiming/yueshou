"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

export async function deleteCustomerMessageAction(input: unknown) {
  const actor = await requireRole("ADMIN");
  const payload = z.object({ id: z.string().min(1), version: z.string().datetime() }).parse(input);
  await prisma.$transaction(async (tx) => {
    const record = await tx.inquiry.findFirst({ where: { id: payload.id, source: "CONTACT_MESSAGE", updatedAt: new Date(payload.version) }, select: { id: true } });
    if (!record) throw new Error("留言不存在或已被其他管理员处理");
    await tx.inquiry.delete({ where: { id: record.id } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "CUSTOMER_MESSAGE_DELETED", entityType: "Inquiry", entityId: record.id } });
  });
  revalidatePath("/admin/customer-messages");
}
