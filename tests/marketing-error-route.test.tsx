import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "de" }),
}));

import MarketingError from "@/app/[locale]/(marketing)/error";

describe("marketing route error boundary", () => {
  it("uses the Next.js reset callback for its localized retry action", () => {
    const reset = vi.fn();
    const ErrorBoundary = MarketingError as unknown as ComponentType<{
      error: Error & { digest?: string };
      reset: () => void;
    }>;

    render(<ErrorBoundary error={new Error("private database failure")} reset={reset} />);

    expect(screen.getByRole("alert")).not.toHaveTextContent("private database failure");
    fireEvent.click(screen.getByRole("button"));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
