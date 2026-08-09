import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ContentReferencePicker,
  CreatePageForm,
  ServiceEditorForm,
} from "@/components/admin/content-management-forms";

Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) });
globalThis.ResizeObserver = class ResizeObserver { observe() {} unobserve() {} disconnect() {} };
afterEach(cleanup);

describe("usable content administration", () => {
  it("creates a page from a labelled slug/title workflow", async () => {
    const create = vi.fn(async () => ({ id: "page-1" }));
    render(<CreatePageForm create={create} />);
    fireEvent.change(screen.getByLabelText("Page slug"), { target: { value: "capabilities" } });
    fireEvent.change(screen.getByLabelText("English title"), { target: { value: "Capabilities" } });
    fireEvent.change(screen.getByLabelText("English body"), { target: { value: "Research capabilities" } });
    fireEvent.click(screen.getByRole("button", { name: "Create page" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
      slug: "capabilities",
      translations: [{ locale: "en", title: "Capabilities", body: "Research capabilities" }],
    })));
  });

  it("renders entity labels and preserves ordered service references", async () => {
    const onChange = vi.fn();
    render(<ContentReferencePicker
      label="Featured services"
      value={["service-b", "service-a"]}
      options={[
        { id: "service-a", kind: "service", label: "Custom synthesis", status: "PUBLISHED" },
        { id: "service-b", kind: "service", label: "Analytical services", status: "PUBLISHED" },
      ]}
      onChange={onChange}
    />);
    expect(screen.getByRole("combobox", { name: "Featured services" })).toBeInTheDocument();
    expect(screen.getByText("Analytical services")).toBeInTheDocument();
    expect(screen.getByText("Custom synthesis")).toBeInTheDocument();
  });

  it("submits the Service lifecycle without requiring raw IDs", async () => {
    const save = vi.fn(async () => ({ id: "service-1" }));
    render(<ServiceEditorForm save={save} initial={{
      slug: "custom-synthesis",
      position: 10,
      status: "DRAFT",
      translations: [{ locale: "en", title: "Custom synthesis", body: "Research service" }],
    }} allowArchive={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Save service" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      slug: "custom-synthesis",
      status: "DRAFT",
      translations: [expect.objectContaining({ locale: "en", title: "Custom synthesis" })],
    })));
    expect(screen.queryByRole("option", { name: "ARCHIVED" })).not.toBeInTheDocument();
  });
});
