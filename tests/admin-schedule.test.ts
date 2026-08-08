import { describe, expect, it } from "vitest";
import { isoToLocalDateTime, localDateTimeToIso } from "@/features/admin/schedule";
describe("admin schedule conversion", () => { it("round-trips a datetime-local value through UTC", () => { const local = "2026-08-08T13:45"; const iso = localDateTimeToIso(local); expect(iso).toBeTruthy(); expect(isoToLocalDateTime(iso)).toBe(local); }); });
