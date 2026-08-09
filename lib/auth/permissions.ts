import type { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export { can, type Permission } from "./access";

export type SessionIdentity = { id: string; role: UserRole; version: string };
export type AuthenticatedUser = SessionIdentity & { email: string; name: string | null };

export class AuthorizationError extends Error {
  constructor(
    readonly code: "unauthenticated" | "session_stale" | "forbidden",
    readonly status: 401 | 403,
  ) {
    super(code === "forbidden" ? "Forbidden" : "Authentication required");
    this.name = "AuthorizationError";
  }
}

type AuthorizationDependencies = {
  readSessionIdentity(): Promise<SessionIdentity | null>;
  findActiveUser(id: string): Promise<AuthenticatedUser | null>;
};

export function createAuthorization(dependencies: AuthorizationDependencies) {
  async function requireUser(): Promise<AuthenticatedUser> {
    const identity = await dependencies.readSessionIdentity();
    if (!identity) throw new AuthorizationError("unauthenticated", 401);

    const current = await dependencies.findActiveUser(identity.id);
    if (!current || current.role !== identity.role || current.version !== identity.version) {
      throw new AuthorizationError("session_stale", 401);
    }
    return current;
  }

  async function requireRole(...roles: UserRole[]): Promise<AuthenticatedUser> {
    const user = await requireUser();
    if (!roles.includes(user.role)) throw new AuthorizationError("forbidden", 403);
    return user;
  }

  return { requireUser, requireRole };
}

const runtimeAuthorization = createAuthorization({
  async readSessionIdentity() {
    const session = await auth();
    const user = session?.user;
    if (!user || typeof user.id !== "string" || typeof user.version !== "string") return null;
    if (user.role !== "ADMIN" && user.role !== "EDITOR") return null;
    return { id: user.id, role: user.role, version: user.version };
  },
  async findActiveUser(id) {
    const user = await prisma.user.findFirst({
      where: { id, isActive: true, deletedAt: null },
      select: { id: true, email: true, name: true, role: true, updatedAt: true },
    });
    return user ? { id: user.id, email: user.email, name: user.name, role: user.role, version: user.updatedAt.toISOString() } : null;
  },
});

export const requireUser = runtimeAuthorization.requireUser;
export const requireRole = runtimeAuthorization.requireRole;

export async function getOptionalUser(): Promise<AuthenticatedUser | null> {
  try {
    return await requireUser();
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) return null;
    throw error;
  }
}
