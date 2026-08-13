import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MediaPicker } from "@/components/admin/media-picker";

afterEach(cleanup);

const available = [
  { id: "asset-a", filename: "alpha.webp", alt: "Alpha peptide vial" },
  { id: "asset-b", filename: "beta.webp", alt: "Beta peptide vial" },
];

it("toggles published assets for a multi-media product selection", () => {
  const onChange = vi.fn();
  render(<MediaPicker multiple available={available} value={["asset-a"]} onChange={onChange} />);

  fireEvent.click(screen.getByRole("button", { name: "从媒体库选择" }));
  expect(screen.getByRole("button", { name: /alpha\.webp/i })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: /beta\.webp/i }));
  expect(onChange).toHaveBeenLastCalledWith(["asset-a", "asset-b"]);
  fireEvent.click(screen.getByRole("button", { name: /alpha\.webp/i }));
  expect(onChange).toHaveBeenLastCalledWith([]);
});

it("selects and clears one published cover asset for an article", () => {
  const onChange = vi.fn();
  render(<MediaPicker available={available} value="asset-a" onChange={onChange} />);

  fireEvent.click(screen.getByRole("button", { name: "从媒体库选择" }));
  fireEvent.click(screen.getByRole("button", { name: /beta\.webp/i }));
  expect(onChange).toHaveBeenLastCalledWith("asset-b");
  fireEvent.click(screen.getByRole("button", { name: "清除选择" }));
  expect(onChange).toHaveBeenLastCalledWith(undefined);
});

it("shows live upload progress while adding a product media asset", async () => {
  const onChange = vi.fn();
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({
      key: "media/tmp/asset.png",
      url: "https://uploads.example.test/signed",
      method: "PUT",
      headers: { "content-type": "image/png" },
    }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: "asset-uploaded" }), { status: 200 }));
  vi.stubGlobal("XMLHttpRequest", MockUploadRequest);
  render(<MediaPicker multiple available={available} value={[]} onChange={onChange} />);

  const file = new File(["image"], "progress.png", { type: "image/png" });
  fireEvent.change(document.querySelector("input[type='file']")!, { target: { files: [file] } });

  await screen.findByText("progress.png");
  await screen.findByText("正在上传到媒体库");
  await waitFor(() => expect(screen.getByText("45%")).toBeInTheDocument());
  MockUploadRequest.last?.finish();
  await waitFor(() => expect(screen.getByText("上传完成")).toBeInTheDocument());
  expect(onChange).toHaveBeenLastCalledWith(["asset-uploaded"]);
});

class MockUploadRequest {
  static last: MockUploadRequest | null = null;
  status = 200;
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    MockUploadRequest.last = this;
  }
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn(() => {
    this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);
  });
  finish() {
    this.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 } as ProgressEvent);
    this.onload?.();
  }
}
