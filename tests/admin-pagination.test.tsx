import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { AdminPagination } from "@/components/admin/server-pagination";

it("renders server pagination links while preserving active filters", () => {
  render(<AdminPagination
    pathname="/admin/products"
    currentPage={2}
    totalItems={80}
    pageSize={25}
    query={{ q: "research peptide", status: "DRAFT" }}
  />);
  expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/admin/products?q=research+peptide&status=DRAFT&page=1");
  expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/admin/products?q=research+peptide&status=DRAFT&page=3");
  expect(screen.getByText("Page 2 of 4")).toBeInTheDocument();
});
