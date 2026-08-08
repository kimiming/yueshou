import { describe, expect, it, vi } from "vitest";

import {
  AuthorizationError,
  can,
  createAuthorization,
  type SessionIdentity,
} from "@/lib/auth/permissions";

describe("role permissions", () => {
  it("allows administrators to manage users and denies editors", () => {
    expect(can({ role: "EDITOR" }, "users:manage")).toBe(false);
    expect(can({ role: "ADMIN" }, "users:manage")).toBe(true);
  });

  it("allows both staff roles to work with content, uploads, and inquiries", () => {
    for (const role of ["ADMIN", "EDITOR"] as const) {
      expect(can({ role }, "content:write")).toBe(true);
      expect(can({ role }, "media:upload")).toBe(true);
      expect(can({ role }, "inquiries:download")).toBe(true);
    }
  });

  it("reserves settings changes and destructive media archive for administrators", () => {
    expect(can({ role: "EDITOR" }, "settings:manage")).toBe(false);
    expect(can({ role: "EDITOR" }, "media:archive")).toBe(false);
    expect(can({ role: "ADMIN" }, "settings:manage")).toBe(true);
    expect(can({ role: "ADMIN" }, "media:archive")).toBe(true);
  });
});

describe("server-side session authorization", () => {
  const identity: SessionIdentity = {
    id: "editor-1",
    role: "EDITOR",
    version: "2026-08-08T10:00:00.000Z",
  };

  it("rejects an unauthenticated request", async () => {
    const authorization = createAuthorization({
      readSessionIdentity: vi.fn(async () => null),
      findActiveUser: vi.fn(),
    });

    await expect(authorization.requireUser()).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("rejects disabled users and stale role/version claims", async () => {
    const disabled = createAuthorization({
      readSessionIdentity: vi.fn(async () => identity),
      findActiveUser: vi.fn(async () => null),
    });
    const changedRole = createAuthorization({
      readSessionIdentity: vi.fn(async () => identity),
      findActiveUser: vi.fn(async () => ({
        id: "editor-1",
        email: "editor@example.test",
        name: "Editor",
        role: "ADMIN" as const,
        version: "2026-08-08T10:05:00.000Z",
      })),
    });

    await expect(disabled.requireUser()).rejects.toMatchObject({ code: "session_stale" });
    await expect(changedRole.requireUser()).rejects.toMatchObject({ code: "session_stale" });
  });

  it("returns a freshly checked user and enforces roles on the server", async () => {
    const authorization = createAuthorization({
      readSessionIdentity: vi.fn(async () => identity),
      findActiveUser: vi.fn(async () => ({
        id: "editor-1",
        email: "editor@example.test",
        name: "Editor",
        role: "EDITOR" as const,
        version: identity.version,
      })),
    });

    await expect(authorization.requireUser()).resolves.toMatchObject({ id: "editor-1", role: "EDITOR" });
    await expect(authorization.requireRole("ADMIN")).rejects.toBeInstanceOf(AuthorizationError);
    await expect(authorization.requireRole("ADMIN", "EDITOR")).resolves.toMatchObject({ role: "EDITOR" });
  });
});
