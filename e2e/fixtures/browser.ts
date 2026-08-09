import { expect, test as base } from "@playwright/test";

/**
 * A release journey must fail on a browser exception or console error instead
 * of silently passing a locator assertion after client-side code has crashed.
 */
export const test = base.extend<{ noCriticalBrowserErrors: void }>({
  noCriticalBrowserErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    const onConsole = (message: { type(): string; text(): string }) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    };
    const onPageError = (error: Error) => errors.push(`pageerror: ${error.message}`);

    page.on("console", onConsole);
    page.on("pageerror", onPageError);
    await use(undefined);
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    expect(errors, errors.join("\n")).toEqual([]);
  }, { auto: true }],
});

export { expect };
