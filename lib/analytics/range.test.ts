import { describe, expect, it } from "vitest";
import { inRange, monthOf, monthsInRange, previousMonth, timestampInRange } from "@/lib/analytics/range";

describe("range", () => {
  it("lists months inclusively across a year boundary", () => {
    expect(monthsInRange({ from: "2025-11", to: "2026-02" })).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("returns no months for an inverted range", () => {
    expect(monthsInRange({ from: "2025-12", to: "2025-06" })).toEqual([]);
  });
  it("checks membership inclusively", () => {
    const r = { from: "2025-09", to: "2025-12" };
    expect(inRange("2025-09", r)).toBe(true);
    expect(inRange("2025-12", r)).toBe(true);
    expect(inRange("2025-08", r)).toBe(false);
    expect(timestampInRange(null, r)).toBe(false);
    expect(timestampInRange("2025-12-31T23:59:59Z", r)).toBe(true);
  });
  it("derives months from UTC timestamps and dates", () => {
    expect(monthOf("2025-06-30T23:00:00Z")).toBe("2025-06");
    expect(monthOf("2025-07-01")).toBe("2025-07");
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(previousMonth("2025-10")).toBe("2025-09");
  });
});
