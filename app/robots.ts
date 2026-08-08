import type { MetadataRoute } from "next";

import { absoluteSiteUrl } from "@/features/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/preview",
        "/*/preview",
        "/search",
        "/*/search",
      ],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
  };
}
