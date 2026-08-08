import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";

Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) });
globalThis.ResizeObserver = class ResizeObserver { observe() {} unobserve() {} disconnect() {} };
afterEach(cleanup);

it("submits a tag without category-only body or status fields", async () => {
  const save = vi.fn(async () => undefined);
  render(<TaxonomyManager kind="tag" title="Tags" items={[]} save={save} />);
  expect(screen.queryByPlaceholderText("English description")).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("slug"), { target: { value: "research" } });
  fireEvent.change(screen.getByPlaceholderText("English name"), { target: { value: "Research" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith({ id: undefined, version: undefined, slug: "research", title: "Research" }));
});

it("requires and rehydrates category body data", () => {
  render(<TaxonomyManager kind="category" title="Categories" items={[{ id: "cat-1", slug: "research", label: "Research", body: "Peptide research", status: "DRAFT", version: "2026-08-09T00:00:00.000Z" }]} save={vi.fn(async () => undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByPlaceholderText("English description")).toHaveValue("Peptide research");
});
