import { describe, expect, it } from "vitest";

import { countryFromHeaders, localeFromPath, normalizeAnalyticsPath, parseUserAgent } from "@/features/analytics/traffic";

describe("traffic analytics", () => {
  it("normalizes public paths and rejects admin or malformed paths", () => {
    expect(normalizeAnalyticsPath("/en/products/example?source=test")).toBe("/en/products/example");
    expect(normalizeAnalyticsPath("/admin/products")).toBeNull();
    expect(normalizeAnalyticsPath("https://evil.example/path")).toBeNull();
    expect(localeFromPath("/zh-CN/products")).toBe("zh-CN");
  });

  it("classifies common devices and browsers", () => {
    expect(parseUserAgent("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/17 Mobile Safari/604.1")).toEqual({ deviceType: "Mobile", browser: "Safari" });
    expect(parseUserAgent("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/125.0 Safari/537.36 Edg/125.0")).toEqual({ deviceType: "Desktop", browser: "Edge" });
  });

  it("uses only valid CDN country codes", () => {
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "de" }))).toBe("DE");
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "XX" }))).toBeNull();
  });
});
