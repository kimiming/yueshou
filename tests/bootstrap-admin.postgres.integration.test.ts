// @vitest-environment node

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import { createBootstrapAdmin } from "../prisma/bootstrap-admin";

const databaseUrl = process.env.DATABASE_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;
const prisma = databaseUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
  : undefined;

afterAll(async () => {
  await prisma?.$disconnect();
});

describeWithPostgres("PostgreSQL bootstrap advisory lock (requires DATABASE_URL)", () => {
  it("executes the transaction-scoped lock before failing closed for an existing email", async () => {
    const email = `bootstrap-lock-${randomUUID()}@example.test`;
    const user = await prisma!.user.create({ data: { email, passwordHash: "test-hash", role: UserRole.EDITOR } });

    try {
      await expect(prisma!.$transaction((transaction) => createBootstrapAdmin(transaction, { email, passwordHash: "new-test-hash" }), { isolationLevel: "Serializable" }))
        .rejects.toThrow("bootstrap_admin_exists");
    } finally {
      await prisma!.user.delete({ where: { id: user.id } });
    }
  });
});
