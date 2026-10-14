import { describe, expect, it } from "vitest";
import { filtersToQuery, hrefWithFilters, parseFilters, presetRange, previousPeriod } from "@/lib/filters";

const MONTHS = ["2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"];
const ctx = { months: MONTHS, branchIds: ["B1", "B2"] };

describe("parseFilters", () => {
  it("defaults to the last 3 months, all branches", () => {
    expect(parseFilters({}, ctx)).toEqual({ preset: "3m", range: { from: "2025-10", to: "2025-12" }, branchId: null });
  });

  it("reads presets", () => {
    expect(parseFilters({ range: "6m" }, ctx).range).toEqual({ from: "2025-07", to: "2025-12" });
    expect(parseFilters({ range: "all" }, ctx).range).toEqual({ from: "2025-06", to: "2025-12" });
  });

  it("reads a custom range, swapping reversed bounds", () => {
    expect(parseFilters({ from: "2025-08", to: "2025-09" }, ctx)).toMatchObject({
      preset: "custom",
      range: { from: "2025-08", to: "2025-09" },
    });
    expect(parseFilters({ from: "2025-11", to: "2025-07" }, ctx).range).toEqual({ from: "2025-07", to: "2025-11" });
  });

  it("falls back to defaults for invalid values instead of erroring", () => {
    expect(parseFilters({ range: "10y", branch: "B9" }, ctx)).toMatchObject({ preset: "3m", branchId: null });
    expect(parseFilters({ from: "2024-01", to: "2025-09" }, ctx).preset).toBe("3m");
    expect(parseFilters({ from: "2025-08" }, ctx).preset).toBe("3m");
  });

  it("takes the first value of repeated params", () => {
    expect(parseFilters({ branch: ["B2", "B1"] }, ctx).branchId).toBe("B2");
  });

  it("anchors presets on the latest month and clamps to available data", () => {
    expect(presetRange("6m", ["2025-11", "2025-12"])).toEqual({ from: "2025-11", to: "2025-12" });
  });
});

describe("filtersToQuery", () => {
  it("omits defaults so the canonical URL is clean", () => {
    expect(filtersToQuery(parseFilters({}, ctx))).toBe("");
  });

  it("round-trips through parseFilters", () => {
    for (const params of [{ range: "all", branch: "B2" }, { from: "2025-07", to: "2025-09" }, { range: "6m" }]) {
      const filters = parseFilters(params, ctx);
      const query = Object.fromEntries(new URLSearchParams(filtersToQuery(filters)));
      expect(parseFilters(query, ctx)).toEqual(filters);
    }
  });

  it("builds drill-down links that keep the date filter", () => {
    const filters = parseFilters({ range: "6m" }, ctx);
    expect(hrefWithFilters("/", filters, { branchId: "B1" })).toBe("/?range=6m&branch=B1");
  });
});

describe("previousPeriod", () => {
  it("returns the equal-length period before", () => {
    expect(previousPeriod({ from: "2025-10", to: "2025-12" }, MONTHS)).toEqual({ from: "2025-07", to: "2025-09" });
    expect(previousPeriod({ from: "2025-12", to: "2025-12" }, MONTHS)).toEqual({ from: "2025-11", to: "2025-11" });
  });

  it("returns null when the data doesn't cover a full prior period", () => {
    expect(previousPeriod({ from: "2025-07", to: "2025-12" }, MONTHS)).toBeNull();
    expect(previousPeriod({ from: "2025-06", to: "2025-12" }, MONTHS)).toBeNull();
  });
});
