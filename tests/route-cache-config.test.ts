import { describe, expect, it } from "vitest";

import { dynamic as homeDynamic } from "@/app/[locale]/(marketing)/page";
import { dynamic as pageDynamic } from "@/app/[locale]/(marketing)/[slug]/page";
import { dynamic as legalDynamic } from "@/app/[locale]/(marketing)/legal/[slug]/page";
import { dynamic as articleDynamic } from "@/app/[locale]/(marketing)/news/[slug]/page";
import { dynamic as newsDynamic } from "@/app/[locale]/(marketing)/news/page";
import { dynamic as productDynamic } from "@/app/[locale]/(marketing)/products/[slug]/page";
import { dynamic as productsDynamic } from "@/app/[locale]/(marketing)/products/page";
import { dynamic as serviceDynamic } from "@/app/[locale]/(marketing)/services/[slug]/page";
import { dynamic as servicesDynamic } from "@/app/[locale]/(marketing)/services/page";
import { dynamic as quoteDynamic } from "@/app/[locale]/(marketing)/request-a-quote/page";
import { dynamic as searchDynamic } from "@/app/[locale]/(marketing)/search/page";

describe("marketing route cache policy", () => {
  it("allows tagged data caching for public editorial routes", () => {
    expect([
      homeDynamic,
      pageDynamic,
      legalDynamic,
      articleDynamic,
      newsDynamic,
      productDynamic,
      productsDynamic,
      serviceDynamic,
      servicesDynamic,
    ]).toEqual(Array(9).fill("auto"));
  });

  it("keeps request-bound search and quote routes dynamic", () => {
    expect([searchDynamic, quoteDynamic]).toEqual(["force-dynamic", "force-dynamic"]);
  });
});
