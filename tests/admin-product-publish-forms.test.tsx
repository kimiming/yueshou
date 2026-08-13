import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Modal } from "antd";
import { afterEach, expect, it, vi } from "vitest";

import { ExistingContentForm, ProductForm } from "@/components/admin/domain-forms";

Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) });
globalThis.ResizeObserver = class ResizeObserver { observe() {} unobserve() {} disconnect() {} };

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("shows a success dialog after creating and publishing a product", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));
  const success = vi.spyOn(Modal, "success").mockImplementation(() => ({ destroy: vi.fn(), update: vi.fn() }));
  const save = vi.fn(async () => ({ id: "product-1", status: "PUBLISHED", version: "2026-08-13T00:00:01.000Z" }));
  render(<ProductForm categories={[{ id: "category-1", label: "Research" }]} save={save} />);

  fireEvent.mouseDown(screen.getByLabelText("分类"));
  fireEvent.click((await screen.findAllByText("Research")).at(-1)!);
  fireEvent.change(screen.getByLabelText("产品标题"), { target: { value: "Test peptide" } });
  fireEvent.change(screen.getByLabelText("产品内容"), { target: { value: "Research product" } });
  fireEvent.click(screen.getByRole("button", { name: "保存并发布产品" }));

  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ categoryId: "category-1", slug: "test-peptide", status: "PUBLISHED" })));
  expect(success).toHaveBeenCalledWith(expect.objectContaining({ title: "发布成功" }));
});

it("uses the latest returned version for consecutive product publishes", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));
  vi.spyOn(Modal, "success").mockImplementation(() => ({ destroy: vi.fn(), update: vi.fn() }));
  const save = vi.fn()
    .mockResolvedValueOnce({ id: "product-1", status: "PUBLISHED", version: "2026-08-13T00:00:01.000Z" })
    .mockResolvedValueOnce({ id: "product-1", status: "PUBLISHED", version: "2026-08-13T00:00:02.000Z" });
  render(<ExistingContentForm kind="product" initial={{ id: "product-1", version: "2026-08-13T00:00:00.000Z", categoryId: "category-1", slug: "test-peptide", status: "PUBLISHED", mediaIds: [], translations: [{ locale: "en", title: "Test peptide", body: "Research product" }] }} categories={[{ id: "category-1", label: "Research" }]} save={save} />);

  fireEvent.click(screen.getByRole("button", { name: "保存并立即发布" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  const submit = screen.getByText("保存并立即发布").closest("button")!;
  await waitFor(() => expect(submit).not.toHaveClass("ant-btn-loading"));
  fireEvent.click(submit);

  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1]?.[0]).toEqual(expect.objectContaining({ version: "2026-08-13T00:00:01.000Z" }));
});

it("shows a failure dialog when product publishing fails", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));
  const failure = vi.spyOn(Modal, "error").mockImplementation(() => ({ destroy: vi.fn(), update: vi.fn() }));
  const save = vi.fn(async () => { throw new Error("产品已被其他管理员修改"); });
  render(<ExistingContentForm kind="product" initial={{ id: "product-1", version: "2026-08-13T00:00:00.000Z", categoryId: "category-1", slug: "test-peptide", status: "PUBLISHED", mediaIds: [], translations: [{ locale: "en", title: "Test peptide", body: "Research product" }] }} categories={[{ id: "category-1", label: "Research" }]} save={save} />);

  fireEvent.click(screen.getByRole("button", { name: "保存并立即发布" }));

  await waitFor(() => expect(failure).toHaveBeenCalledWith(expect.objectContaining({ title: "发布失败", content: "产品已被其他管理员修改" })));
});
