import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { signIn, signOut, replace, refresh } = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/auth", () => ({ signIn, signOut }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ replace, refresh }),
}));

import { createAdminDashboardLayout } from "@/components/admin/dashboard-layout";
import { createAdminLoginPage } from "@/components/admin/login-page";
import { AdminShell } from "@/components/admin/admin-shell";
import { attemptAdminLogin, GENERIC_LOGIN_ERROR } from "@/components/admin/login-form";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

const editor: AuthenticatedUser = {
  id: "editor-1",
  email: "editor@example.test",
  name: "Content Editor",
  role: "EDITOR",
  version: "2026-08-08T10:00:00.000Z",
};

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("admin route guards", () => {
  it("redirects an unauthenticated dashboard request to the login page", async () => {
    const redirect = vi.fn(() => { throw new Error("redirected"); });
    const Layout = createAdminDashboardLayout({ getUser: async () => null, redirect });

    await expect(Layout({ children: <p>private</p> })).rejects.toThrow("redirected");
    expect(redirect).toHaveBeenCalledWith("/admin/login");
  });

  it("renders login for guests and redirects an authenticated user away from login", async () => {
    const guestRedirect = vi.fn();
    const GuestPage = createAdminLoginPage({ getUser: async () => null, redirect: guestRedirect });
    render(await GuestPage());
    expect(screen.getByRole("heading", { name: "Staff sign in" })).toBeInTheDocument();
    expect(guestRedirect).not.toHaveBeenCalled();

    expect(renderToStaticMarkup(await GuestPage())).not.toContain("ant-card");

    cleanup();
    const redirect = vi.fn(() => { throw new Error("redirected"); });
    const UserPage = createAdminLoginPage({ getUser: async () => editor, redirect });
    await expect(UserPage()).rejects.toThrow("redirected");
    expect(redirect).toHaveBeenCalledWith("/admin");
  });
});

describe("admin login", () => {
  it("returns one accessible generic error for invalid credentials", async () => {
    const authenticate = vi.fn(async () => ({ ok: false, error: "CredentialsSignin", status: 401, url: null }));

    await expect(attemptAdminLogin(authenticate, "missing@example.test", "guess")).resolves.toEqual({
      ok: false,
      error: GENERIC_LOGIN_ERROR,
    });
    await expect(attemptAdminLogin(authenticate, "admin@example.test", "wrong")).resolves.toEqual({
      ok: false,
      error: GENERIC_LOGIN_ERROR,
    });
  });
});

describe("admin shell", () => {
  it("shows editor-safe navigation and the current user without admin-only user management", () => {
    render(<AdminShell user={editor}><p>Dashboard content</p></AdminShell>);

    expect(screen.getByRole("navigation", { name: "Administration" })).toBeInTheDocument();
    expect(screen.getByText("Content Editor")).toBeInTheDocument();
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
  });
});
