import { describe, expect, it } from "vitest";

import {
  isGenericPageSlug,
  isLegalPageSlug,
  isPublicContentSlug,
} from "@/features/content/public-slug";

describe("public content slugs", () => {
  it.each(["bpc-157", "quality", "shipping-compliance"])(
    "accepts the normalized slug %s",
    (slug) => expect(isPublicContentSlug(slug)).toBe(true),
  );

  it.each(["", "About", "../draft", "two/slugs", "has space"])(
    "rejects the invalid slug %s",
    (slug) => expect(isPublicContentSlug(slug)).toBe(false),
  );

  it("recognizes only the five approved legal route slugs", () => {
    expect(isLegalPageSlug("privacy")).toBe(true);
    expect(isLegalPageSlug("terms")).toBe(true);
    expect(isLegalPageSlug("invented-policy")).toBe(false);
  });

  it("allows non-reserved CMS slugs on the generic page route", () => {
    expect(isGenericPageSlug("quality")).toBe(true);
    expect(isGenericPageSlug("about")).toBe(false);
    expect(isGenericPageSlug("home")).toBe(false);
    expect(isGenericPageSlug("privacy")).toBe(false);
  });
});
