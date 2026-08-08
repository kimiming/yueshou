import { describe, expect, it } from "vitest";
import { isoToLocalDateTime, localDateTimeToIso } from "@/features/admin/schedule";
describe("admin schedule conversion", () => { it.each(["2026-01-08T13:45", "2026-07-08T13:45"])("round-trips the target local date across seasonal offsets: %s", (local) => { const iso = localDateTimeToIso(local); expect(iso).toBeTruthy(); expect(isoToLocalDateTime(iso)).toBe(local); }); });
