import { describe, expect, it } from "vitest";

import { EditorValidationError } from "@/features/admin/editors";
import { uniqueConstraintConflict } from "@/features/admin/repository";

describe("editor repository conflict mapping", () => {
  it.each([
    ["Page_slug_key", "slug is already in use"],
    ["PageTranslation_entityId_locale_key", "translation already exists for this locale"],
    ["Tenant_domain_key", "domain is already in use"],
  ])("maps %s uniqueness errors to an actionable validation error", (target, message) => {
    const error = uniqueConstraintConflict({ code: "P2002", meta: { target } });

    expect(error).toBeInstanceOf(EditorValidationError);
    expect(error.message).toContain(message);
  });
});
