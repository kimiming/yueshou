import { expect, test } from "./fixtures/browser";
import { e2eMutationSkipReason, hasE2eMutationFixture } from "./fixtures/database";

test.describe("research inquiry", () => {
  test.skip(!hasE2eMutationFixture, e2eMutationSkipReason);

  test("invalid submission reports the required fields without contacting external storage", async ({ page }) => {
    await page.goto("/en/request-a-quote");
    await page.getByRole("button", { name: "Submit inquiry" }).click();
    await expect(page.getByText("This field is required.").first()).toBeVisible();
  });

  test("valid no-attachment inquiry reaches the server-side success state", async ({ page }) => {
    await page.goto("/en/request-a-quote");
    await page.getByLabel("Company or institution").fill(`E2E Research ${Date.now()}`);
    await page.getByLabel("Contact name").fill("Release Test");
    await page.getByLabel("Institutional email").fill(`release-${Date.now()}@example.test`);
    await page.getByLabel("Country").fill("Germany");
    await page.getByLabel("Project details").fill("Research-use-only peptide synthesis inquiry for release validation.");
    await page.getByRole("checkbox", { name: /I consent to the use/i }).check();
    await page.getByRole("button", { name: "Submit inquiry" }).click();
    await expect(page.getByRole("status")).toHaveText("Thank you. Your inquiry has been received.");
  });
});
