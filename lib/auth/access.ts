import type { UserRole } from "@prisma/client";

export type Permission =
  | "content:read"
  | "content:write"
  | "content:publish"
  | "media:read"
  | "media:upload"
  | "media:archive"
  | "inquiries:read"
  | "inquiries:manage"
  | "inquiries:download"
  | "settings:read"
  | "settings:manage"
  | "users:read"
  | "users:manage";

const permissionTable: Record<UserRole, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([
    "content:read", "content:write", "content:publish",
    "media:read", "media:upload", "media:archive",
    "inquiries:read", "inquiries:manage", "inquiries:download",
    "settings:read", "settings:manage", "users:read", "users:manage",
  ]),
  EDITOR: new Set<Permission>([
    "content:read", "content:write", "content:publish",
    "media:read", "media:upload",
    "inquiries:read", "inquiries:manage", "inquiries:download",
    "settings:read",
  ]),
};

export function can(user: { role: UserRole }, permission: Permission): boolean {
  return permissionTable[user.role].has(permission);
}
