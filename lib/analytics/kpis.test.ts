import { describe, expect, it } from "vitest";
import { sampleDataset } from "@/lib/analytics/fixtures";
import { kpis, mean, ratio } from "@/lib/analytics/kpis";
import { monthlyTrend } from "@/lib/analytics/trend";

const ds = sampleDataset();
const OCT_NOV = { from: "2025-10", to: "2025-11" };

describe("helpers", () => {
  it("ratio and mean return null instead of dividing by zero", () => {
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(1, 4)).toBe(0.25);
    expect(mean([])).toBeNull();
    expect(mean([10, 20])).toBe(15);
  });
});

describe("kpis", () => {
  it("counts bookings by order_placed month, with revenue and attainment", () => {
    const k = kpis(ds.leads, ds.targets, OCT_NOV);
    expect(k.bookedUnits).toBe(2);
    expect(k.bookedRevenue).toBe(5_000_000);
    expect(k.targetUnits).toBe(12);
    expect(k.targetRevenue).toBe(24_000_000);
    expect(k.unitAttainment).toBeCloseTo(2 / 12);
    expect(k.revenueAttainment).toBeCloseTo(5 / 24);
  });

  it("computes win rate from outcomes in the range", () => {
    const k = kpis(ds.leads, ds.targets, OCT_NOV);
    expect(k.wins).toBe(2);
    expect(k.losses).toBe(2);
    expect(k.winRate).toBe(0.5);
  });

  it("averages delivery days for orders placed in the range", () => {
    const k = kpis(ds.leads, ds.targets, OCT_NOV);
    expect(k.deliveredUnits).toBe(1);
    expect(k.avgDaysToDeliver).toBe(20);
  });

  it("reports open pipeline and awaiting delivery as snapshots, including flagged leads", () => {
    const k = kpis(ds.leads, ds.targets, { from: "2025-06", to: "2025-06" });
    expect(k.openPipelineCount).toBe(4); // L4, L5, L6 (flagged), L8
    expect(k.openPipelineValue).toBe(7_000_000);
    expect(k.awaitingDeliveryCount).toBe(1);
    expect(k.awaitingDeliveryValue).toBe(2_000_000);
  });

  it("returns nulls, not zeros or NaN, for a month with no data", () => {
    const k = kpis(ds.leads, ds.targets, { from: "2025-12", to: "2025-12" });
    expect(k.bookedUnits).toBe(0);
    expect(k.targetUnits).toBe(0);
    expect(k.unitAttainment).toBeNull();
    expect(k.winRate).toBeNull();
    expect(k.avgDaysToDeliver).toBeNull();
  });

  it("returns null targets when the scope has none (a rep)", () => {
    const k = kpis(ds.leadsByRep.R1, null, OCT_NOV);
    expect(k.targetUnits).toBeNull();
    expect(k.unitAttainment).toBeNull();
    expect(k.bookedUnits).toBe(2);
  });

  it("handles no leads at all", () => {
    const k = kpis([], [], OCT_NOV);
    expect(k).toMatchObject({ bookedUnits: 0, bookedRevenue: 0, winRate: null, openPipelineCount: 0 });
  });
});

describe("monthlyTrend", () => {
  const trend = monthlyTrend(ds.leads, ds.targets, { from: "2025-09", to: "2025-12" });

  it("returns one point per month, including empty months", () => {
    expect(trend.map((p) => p.month)).toEqual(["2025-09", "2025-10", "2025-11", "2025-12"]);
    expect(trend.map((p) => p.bookedUnits)).toEqual([0, 1, 1, 0]);
  });

  it("shows target and attainment, null where there is no target", () => {
    expect(trend[0].targetUnits).toBe(0);
    expect(trend[0].unitAttainment).toBeNull();
    expect(trend[1].targetUnits).toBe(6);
    expect(trend[1].unitAttainment).toBeCloseTo(1 / 6);
  });

  it("computes month-over-month change, null for the first month or a zero base", () => {
    expect(trend.map((p) => p.bookedUnitsChange)).toEqual([null, null, 0, -1]);
  });

  it("tracks delivery speed and completeness per order cohort", () => {
    expect(trend[1].avgDaysToDeliver).toBe(20);
    expect(trend[1].deliveryCompleteness).toBe(1);
    expect(trend[2].avgDaysToDeliver).toBeNull();
    expect(trend[2].deliveryCompleteness).toBe(0);
    expect(trend[1].deliveredUnits).toBe(1);
  });

  it("returns null targets for a rep scope", () => {
    expect(monthlyTrend(ds.leadsByRep.R1, null, OCT_NOV)[0].targetUnits).toBeNull();
  });
});
