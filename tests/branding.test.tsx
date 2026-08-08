import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/[locale]/page";
import { metadata } from "@/app/[locale]/layout";

describe("YueShou branding", () => {
  it("uses the required Chinese brand name in root metadata", () => {
    expect(metadata.title).toBe("粤首");
  });

  it("does not render starter platform trademarks on the public home page", () => {
    render(<Home />);

    expect(screen.queryByAltText(/Next\.js logo/i)).not.toBeInTheDocument();
    expect(screen.queryByAltText(/Vercel logomark/i)).not.toBeInTheDocument();
  });
});
