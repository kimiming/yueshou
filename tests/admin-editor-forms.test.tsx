import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { PageEditorForm } from "@/components/admin/editor-forms";

Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) });
globalThis.ResizeObserver = class ResizeObserver { observe() {} unobserve() {} disconnect() {} };
afterEach(cleanup);

it("submits visible page fields as a validated five-language editor payload", async () => {
  const save = vi.fn(async () => undefined);
  render(<PageEditorForm initial={{ id: "page-1", slug: "about", version: "2026-08-08T00:00:00.000Z", translations: [{ locale: "en", title: "About", body: "Research" }] }} save={save} publish={vi.fn(async () => undefined)} archive={vi.fn(async () => undefined)} allowArchive />);

  fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "our-research" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
    id: "page-1",
    slug: "our-research",
    translations: [expect.objectContaining({ locale: "en", title: "About", body: "Research" })],
  })));
});

it("publishes using the version returned by the preceding page save", async () => {
  const save = vi.fn(async () => ({ id: "page-1", version: "2026-08-08T00:00:01.000Z" }));
  const publish = vi.fn(async () => undefined);
  render(<PageEditorForm initial={{ id: "page-1", slug: "about", version: "2026-08-08T00:00:00.000Z", translations: [{ locale: "en", title: "About", body: "Research" }] }} save={save} publish={publish} archive={vi.fn(async () => undefined)} allowArchive />);

  fireEvent.click(screen.getByRole("button", { name: "Publish" }));

  await waitFor(() => expect(publish).toHaveBeenCalledWith({ pageId: "page-1", version: "2026-08-08T00:00:01.000Z", status: "PUBLISHED" }));
});
