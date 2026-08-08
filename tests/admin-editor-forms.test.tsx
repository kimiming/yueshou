import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { PageEditorForm, PageSectionForm, SiteSettingsForm } from "@/components/admin/editor-forms";
import { SortableSections } from "@/components/admin/sortable-sections";
import { PageSectionOrdering } from "@/components/admin/content-ordering";

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

it("exposes draft, publish, and archive controls for the brand setting", () => {
  render(<SiteSettingsForm initial={{ key: "brand", version: "2026-08-08T00:00:00.000Z", status: "DRAFT", value: {}, translations: [{ locale: "en", title: "YueShou", body: "Precision peptides" }] }} save={vi.fn(async () => undefined)} />);

  expect(screen.getByRole("combobox", { name: "Publication status" })).toBeInTheDocument();
  expect(screen.getByLabelText("SEO keywords")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add footer column" })).toBeInTheDocument();
});

it("rehydrates section reference and statistics configuration", () => {
  render(<PageSectionForm initial={{ id: "section-1", pageId: "page-1", version: "2026-08-08T00:00:00.000Z", position: 0, type: "services", config: { serviceIds: ["service-a", "service-b"] }, isEnabled: true, translations: [{ locale: "en", title: "Services", body: "Copy" }] }} save={vi.fn(async () => undefined)} />);
  expect(screen.getByLabelText("Referenced IDs (comma-separated)")).toHaveValue("service-a, service-b");
});

it("persists ordering enable toggles through the supplied handler", () => {
  const onToggle = vi.fn();
  render(<SortableSections sections={[{ id: "section-1", title: "Services", type: "SERVICES", enabled: true }]} onToggle={onToggle} />);
  fireEvent.click(screen.getByRole("switch", { name: "Enable Services" }));
  expect(onToggle).toHaveBeenCalledWith("section-1", false);
});

it("sends the current persisted section payload to the server action on an ordering toggle", async () => {
  const action = vi.fn(async () => undefined);
  render(<PageSectionOrdering pageId="page-1" sections={[{ id: "section-1", title: "Services", type: "SERVICES", enabled: true }]} payloads={{ "section-1": { id: "section-1", pageId: "page-1", version: "2026-08-08T00:00:00.000Z", position: 0, type: "services", config: {}, translations: [{ locale: "en", title: "Services", body: "Copy" }] } }} onToggleAction={action} />);
  fireEvent.click(screen.getByRole("switch", { name: "Enable Services" }));
  await waitFor(() => expect(action).toHaveBeenCalledWith(expect.objectContaining({ id: "section-1", isEnabled: false, version: "2026-08-08T00:00:00.000Z" })));
});
