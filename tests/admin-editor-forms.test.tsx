import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { PageEditorForm, PageSectionForm, SiteSettingsForm } from "@/components/admin/editor-forms";
import { ExistingContentForm, InquiryStatusForm } from "@/components/admin/domain-forms";
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

it("submits the exact persisted legal revision for administrator approval", async () => {
  const approve = vi.fn(async () => ({
    id: "page-terms",
    version: "2026-08-08T00:00:01.000Z",
    contentRevision: 8,
    legalReviewedRevision: 8,
  }));
  render(<PageEditorForm
    initial={{
      id: "page-terms",
      slug: "terms",
      version: "2026-08-08T00:00:00.000Z",
      status: "DRAFT",
      contentRevision: 8,
      legalReviewStatus: "PENDING",
      translations: [{ locale: "en", title: "Terms", body: "Current terms" }],
    }}
    save={vi.fn(async () => undefined)}
    publish={vi.fn(async () => undefined)}
    archive={vi.fn(async () => undefined)}
    approve={approve}
    allowArchive
  />);

  fireEvent.click(screen.getByRole("button", { name: "Approve current legal revision" }));

  await waitFor(() => expect(approve).toHaveBeenCalledWith({
    pageId: "page-terms",
    version: "2026-08-08T00:00:00.000Z",
    contentRevision: 8,
  }));
  expect(await screen.findByRole("status")).toHaveTextContent("Legal revision 8 approved");
});

it("publishes an approved legal revision without rewriting its reviewed content", async () => {
  const publish = vi.fn(async () => ({ id: "page-terms", version: "2026-08-08T00:00:01.000Z" }));
  const transition = vi.fn(async () => undefined);
  render(<PageEditorForm
    initial={{
      id: "page-terms",
      slug: "terms",
      version: "2026-08-08T00:00:00.000Z",
      status: "DRAFT",
      contentRevision: 8,
      legalReviewStatus: "APPROVED",
      translations: [{ locale: "en", title: "Terms", body: "Reviewed terms" }],
    }}
    save={vi.fn(async () => undefined)}
    publish={publish}
    archive={vi.fn(async () => undefined)}
    approve={vi.fn(async () => undefined)}
    transition={transition}
    allowArchive
  />);

  fireEvent.click(screen.getByRole("button", { name: "Publish" }));

  await waitFor(() => expect(publish).toHaveBeenCalledWith({
    pageId: "page-terms",
    version: "2026-08-08T00:00:00.000Z",
    status: "PUBLISHED",
  }));
  expect(transition).not.toHaveBeenCalled();
});

it("does not expose legal approval when the administrator action is unavailable", () => {
  render(<PageEditorForm
    initial={{
      id: "page-terms",
      slug: "terms",
      version: "2026-08-08T00:00:00.000Z",
      status: "DRAFT",
      contentRevision: 8,
      legalReviewStatus: "PENDING",
      translations: [{ locale: "en", title: "Terms", body: "Current terms" }],
    }}
    save={vi.fn(async () => undefined)}
    publish={vi.fn(async () => undefined)}
    archive={vi.fn(async () => undefined)}
    allowArchive={false}
  />);

  expect(screen.queryByRole("button", { name: "Approve current legal revision" })).not.toBeInTheDocument();
});

it("exposes draft, publish, and archive controls for the brand setting", () => {
  render(<SiteSettingsForm initial={{ key: "brand", version: "2026-08-08T00:00:00.000Z", status: "DRAFT", value: {}, translations: [{ locale: "en", title: "yueshou", body: "Precision peptides" }] }} save={vi.fn(async () => undefined)} />);

  expect(screen.getByRole("combobox", { name: "Publication status" })).toBeInTheDocument();
  expect(screen.getByLabelText("SEO keywords")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add footer column" })).toBeInTheDocument();
});

it("selects brand assets by published filename instead of requiring raw media IDs", () => {
  render(<SiteSettingsForm
    initial={{ key: "brand", version: "2026-08-08T00:00:00.000Z", status: "DRAFT", value: { logoMediaId: "media-logo" }, translations: [{ locale: "en", title: "yueshou", body: "Precision peptides" }] }}
    mediaOptions={[{ id: "media-logo", filename: "brand-logo.png", alt: "yueshou logo" }]}
    save={vi.fn(async () => undefined)}
  />);

  expect(screen.getAllByRole("button", { name: /brand-logo\.png/ })).toHaveLength(2);
  expect(screen.queryByLabelText("Logo media ID")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Favicon media ID")).not.toBeInTheDocument();
});

it("announces an authoritative settings save outcome", async () => {
  render(<SiteSettingsForm initial={{ key: "brand", version: "2026-08-08T00:00:00.000Z", status: "PUBLISHED", value: {}, translations: [{ locale: "en", title: "yueshou", body: "Precision peptides" }] }} save={vi.fn(async () => undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Settings saved");
});

it("rehydrates section reference and statistics configuration", () => {
  render(<PageSectionForm referenceOptions={[
    { id: "service-a", kind: "service", label: "Custom synthesis", status: "PUBLISHED" },
    { id: "service-b", kind: "service", label: "Analytics", status: "PUBLISHED" },
  ]} initial={{ id: "section-1", pageId: "page-1", version: "2026-08-08T00:00:00.000Z", position: 0, type: "services", config: { serviceIds: ["service-a", "service-b"] }, isEnabled: true, translations: [{ locale: "en", title: "Services", body: "Copy" }] }} save={vi.fn(async () => undefined)} />);
  expect(screen.getByRole("combobox", { name: "Referenced services" })).toBeInTheDocument();
  expect(screen.getByText("Custom synthesis")).toBeInTheDocument();
  expect(screen.getByText("Analytics")).toBeInTheDocument();
});

it("announces authoritative section and article save outcomes", async () => {
  render(<PageSectionForm initial={{ id: "section-1", pageId: "page-1", version: "2026-08-08T00:00:00.000Z", position: 0, type: "hero", config: {}, isEnabled: true, translations: [{ locale: "en", title: "Hero", body: "Copy" }] }} save={vi.fn(async () => undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Save section" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Section saved");
  cleanup();

  render(<ExistingContentForm kind="article" initial={{ id: "article-1", version: "2026-08-08T00:00:00.000Z", categoryId: "category-1", slug: "release", status: "DRAFT", translations: [{ locale: "en", title: "Release", body: "Copy" }] }} categories={[{ id: "category-1", label: "Research" }]} save={vi.fn(async () => undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Article saved as DRAFT");
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

it("advances the inquiry version after each authoritative mutation", async () => {
  const update = vi.fn(async () => ({ version: "2026-08-08T00:00:01.000Z" }));
  const saveNotes = vi.fn(async () => ({ version: "2026-08-08T00:00:02.000Z" }));
  render(<InquiryStatusForm
    inquiryId="inq-1"
    status="NEW"
    notes={null}
    version="2026-08-08T00:00:00.000Z"
    update={update}
    saveNotes={saveNotes}
  />);

  fireEvent.mouseDown(screen.getByLabelText("Status"));
  fireEvent.click((await screen.findAllByText("IN_PROGRESS")).at(-1)!);
  fireEvent.click(screen.getByRole("button", { name: "Update status" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith({ inquiryId: "inq-1", status: "IN_PROGRESS", version: "2026-08-08T00:00:00.000Z" }));

  fireEvent.change(screen.getByLabelText("Internal notes"), { target: { value: "Reviewed" } });
  fireEvent.click(screen.getByRole("button", { name: /Save notes/ }));
  await waitFor(() => expect(saveNotes).toHaveBeenCalledWith({ inquiryId: "inq-1", internalNotes: "Reviewed", version: "2026-08-08T00:00:01.000Z" }));
});
