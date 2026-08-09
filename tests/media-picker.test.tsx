import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  expect(screen.getByRole("button", { name: /alpha\.webp/i })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: /beta\.webp/i }));
  expect(onChange).toHaveBeenLastCalledWith(["asset-a", "asset-b"]);
  fireEvent.click(screen.getByRole("button", { name: /alpha\.webp/i }));
  expect(onChange).toHaveBeenLastCalledWith([]);
});

it("selects and clears one published cover asset for an article", () => {
  const onChange = vi.fn();
  render(<MediaPicker available={available} value="asset-a" onChange={onChange} />);

  fireEvent.click(screen.getByRole("button", { name: /beta\.webp/i }));
  expect(onChange).toHaveBeenLastCalledWith("asset-b");
  fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
  expect(onChange).toHaveBeenLastCalledWith(undefined);
});
