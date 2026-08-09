import { expect, type Page } from "@playwright/test";

import { e2eAdmin } from "./database";

/** Sign in through the real Credentials provider; no auth cookie is forged. */
export async function signInAsConfiguredAdmin(page: Page) {
  if (!e2eAdmin.email || !e2eAdmin.password) {
    throw new Error("E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required for an authenticated browser journey.");
  }

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(e2eAdmin.email);
  await page.getByLabel("Password").fill(e2eAdmin.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
