import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { buildDataset } from "@/lib/analytics/enrich";
import { sampleDataset } from "@/lib/analytics/fixtures";
import { monthlyTrend } from "@/lib/analytics/trend";
import { TREND_HEADROOM, axisTicks, defaultTrendMetric, niceCeil, trendScale } from "@/lib/analytics/trend-scale";
import { parseDataset } from "@/lib/analytics/validate";

const real = buildDataset(parseDataset(rawJson as unknown));
const ALL = { from: "2025-06", to: "2025-12" };

describe("niceCeil", () => {
  it("rounds up to a nearby round number", () => {
    expect(niceCeil(63)).toBe(75);
    expect(niceCeil(48)).toBe(50);
    expect(niceCeil(21)).toBe(25);
    expect(niceCeil(4.5)).toBe(5);
    expect(niceCeil(1.1)).toBe(1.2);
    expect(niceCeil(0.27)).toBe(0.3);
    expect(niceCeil(200)).toBe(200);
    expect(niceCeil(0)).toBe(0);
  });
});

describe("axisTicks", () => {
  it("spaces ticks evenly on a round step that ends at the cap", () => {
    expect(axisTicks(75)).toEqual([0, 25, 50, 75]);
    expect(axisTicks(0.3)).toEqual([0, 0.1, 0.2, 0.3]);
    expect(axisTicks(80)).toEqual([0, 20, 40, 60, 80]);
    expect(axisTicks(1.2)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1, 1.2]);
    expect(axisTicks(0)).toEqual([0]);
  });

  it("is used by the scale", () => {
    const trend = monthlyTrend(real.leads, real.targets, ALL);
    const s = trendScale(trend, "units");
    expect(s.ticks.at(-1)).toBe(s.max);
    expect(s.ticks[0]).toBe(0);
  });
});

describe("trendScale on the company trend", () => {
  const trend = monthlyTrend(real.leads, real.targets, ALL);

  it("caps units near 1.5× the largest month and marks the target off-scale with its range", () => {
    const peak = Math.max(...trend.map((p) => p.bookedUnits)); // 42 in Oct
    const s = trendScale(trend, "units");
    expect(s.max).toBe(niceCeil(peak * TREND_HEADROOM));
    expect(s.max).toBeLessThan(peak * 2);
    expect(s.target).toEqual({ offScale: true, min: 181, max: 240 });
  });

  it("does the same for revenue", () => {
    const s = trendScale(trend, "revenue");
    expect(s.target?.offScale).toBe(true);
    expect(s.max).toBeGreaterThanOrEqual(Math.max(...trend.map((p) => p.bookedRevenue)));
  });

  it("plots attainment as a share, with the 100% target off-scale", () => {
    const s = trendScale(trend, "attainment");
    const peak = Math.max(...trend.map((p) => p.unitAttainment ?? 0)); // ~18%
    expect(s.max).toBeGreaterThanOrEqual(peak);
    expect(s.max).toBeLessThan(1);
    expect(s.target).toEqual({ offScale: true, min: 1, max: 1 });
  });

  it("opens on attainment when targets exist", () => {
    expect(defaultTrendMetric(trend)).toBe("attainment");
  });
});

describe("trendScale edge cases", () => {
  it("draws the target when it fits under the cap", () => {
    const ds = sampleDataset(); // B1 Oct: 1 booked vs 4 target → off-scale; make a target that fits
    const trend = monthlyTrend(ds.leads, [{ branch_id: "B1", month: "2025-10", target_units: 1, target_revenue: 1 }], { from: "2025-10", to: "2025-11" });
    expect(trendScale(trend, "units").target).toEqual({ offScale: false, min: 1, max: 1 });
  });

  it("has no target for a rep and opens on units", () => {
    const ds = sampleDataset();
    const trend = monthlyTrend(ds.leadsByRep.R1, null, { from: "2025-09", to: "2025-12" });
    expect(trendScale(trend, "units").target).toBeNull();
    expect(trendScale(trend, "attainment").target).toBeNull();
    expect(defaultTrendMetric(trend)).toBe("units");
  });

  it("keeps a usable axis when nothing was booked", () => {
    const empty = monthlyTrend([], null, { from: "2025-10", to: "2025-11" });
    expect(trendScale(empty, "units").max).toBe(1);
    expect(trendScale(empty, "attainment").max).toBe(0.1);
  });
});
