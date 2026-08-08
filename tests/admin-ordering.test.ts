import { describe, expect, it } from "vitest";

import { EditorValidationError } from "@/features/admin/editors";
import { assertExactLiveSet } from "@/features/admin/ordering";

describe("complete live ordering sets", () => {
  it("rejects a missing sibling from an order request", () => {
    expect(() => assertExactLiveSet(["one"], ["one", "two"], "Navigation")).toThrow(EditorValidationError);
  });

  it("rejects a cross-parent or cross-page id that is not in the live collection", () => {
    expect(() => assertExactLiveSet(["one", "foreign"], ["one", "two"], "Section")).toThrow(EditorValidationError);
  });

  it("accepts exactly the live sibling collection in any requested order", () => {
    expect(() => assertExactLiveSet(["two", "one"], ["one", "two"], "Navigation")).not.toThrow();
  });
});
