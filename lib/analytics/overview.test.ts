/** Overview view model + insight rules, against the fixture and the real dataset. */
import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { dataNotes } from "@/lib/analytics/data-notes";
import { buildDataset } from "@/lib/analytics/enrich";
import { sampleDataset } from "@/lib/analytics/fixtures";
import { biggestDrop, funnel } from "@/lib/analytics/funnel";
import { overviewInsight, type InsightInput } from "@/lib/analytics/insights";
import { kpis } from "@/lib/analytics/kpis";
import { buildOverview } from "@/lib/analytics/overview";
import { parseDataset } from "@/lib/analytics/validate";
import { parseFilters } from "@/lib/filters";

const real = buildDataset(parseDataset(rawJson as unknown));
const ctx = (ds: typeof real) => ({ months: ds.months, branchIds: ds.branches.map((b) => b.id) });

describe("buildOverview (real data, default filters)", () => {
  const o = buildOverview(real, parseFilters({}, ctx(real)));

  it("compares the last 3 months with the 3 before", () => {
    expect(o.filters.range).toEqual({ from: "2025-10", to: "2025-12" });
    expect(o.previousRange).toEqual({ from: "2025-07", to: "2025-09" });
    expect(o.kpis.bookedUnits).toBe(118);
    expect(o.previousKpis?.bookedUnits).toBe(74);
    expect(o.deltas.bookedUnits).toMatchObject({ label: "+59%", sentiment: "good" });
    expect(o.deltas.avgDaysToDeliver).toMatchObject({ direction: "up", sentiment: "bad" });
  });

  it("leads with the bookings story and the branch that needs action", () => {
    expect(o.insight.headline).toBe(
      "Bookings are up 59% on Jul – Sep 2025 (118 vs 74 cars); Lakeside Toyota needs attention (win rate 14% vs 46% company).",
    );
    expect(o.insight.supporting[0]).toBe("25 orders waiting more than 21 days for delivery.");
  });

  it("ranks branches by revenue with Lakeside flagged", () => {
    expect(o.branches).toHaveLength(5);
    const revenues = o.branches.map((b) => b.kpis.bookedRevenue);
    expect(revenues).toEqual([...revenues].sort((a, b) => b - a));
    expect(o.branches.find((b) => b.branch.id === "B3")?.health.level).toBe("act");
    expect(o.reps).toEqual([]);
  });

  it("shows every month on the trend and marks the selected range", () => {
    expect(o.trend).toHaveLength(7);
    expect(o.trend.filter((p) => p.inRange).map((p) => p.month)).toEqual(["2025-10", "2025-11", "2025-12"]);
  });

  it("assigns action items to an owner", () => {
    expect(o.attention.stuck.count).toBe(25);
    expect(o.attention.stuck.top[0].owner?.role).toBe("branch_manager");
    expect(o.attention.stale.top[0].owner?.role).toBe("sales_officer");
    expect(o.attention.stale.top.length).toBeLessThanOrEqual(3);
  });
});

describe("buildOverview (branch scope)", () => {
  const o = buildOverview(real, parseFilters({ branch: "B3" }, ctx(real)));

  it("scopes everything to the branch and lists its sales officers", () => {
    expect(o.scopeName).toBe("Lakeside Toyota");
    expect(o.branches).toEqual([]);
    expect(o.reps.length).toBeGreaterThan(0);
    expect(o.reps.every((r) => r.rep.branch_id === "B3" && r.rep.role === "sales_officer")).toBe(true);
  });

  it("states small numbers as counts, not percentages", () => {
    expect(o.insight.headline).toBe(
      "5 cars booked in Oct – Dec 2025, vs 4 in Jul – Sep 2025; win rate is 14% vs 46% company-wide.",
    );
    expect(o.deltas.bookedUnits).toBeNull();
  });
});

describe("buildOverview (fixture edge cases)", () => {
  const ds = sampleDataset();

  it("flags an empty period", () => {
    const o = buildOverview(ds, { preset: "custom", range: { from: "2025-10", to: "2025-10" }, branchId: "B2" });
    expect(o.isEmpty).toBe(true);
  });

  it("has no deltas when there is no earlier period", () => {
    const o = buildOverview(ds, { preset: "all", range: { from: "2025-10", to: "2025-11" }, branchId: null });
    expect(o.previousRange).toBeNull();
    expect(o.deltas).toEqual({ bookedRevenue: null, bookedUnits: null, winRate: null, avgDaysToDeliver: null });
    expect(o.insight.headline).toMatch(/^2 cars booked in Oct – Nov 2025/);
  });
});

describe("overviewInsight rules", () => {
  const base = (over: Partial<InsightInput>): InsightInput => {
    const k = kpis([], null, { from: "2025-10", to: "2025-10" });
    return {
      range: { from: "2025-10", to: "2025-12" },
      current: { ...k, bookedUnits: 80 },
      previous: { ...k, bookedUnits: 100 },
      previousRange: { from: "2025-07", to: "2025-09" },
      branches: [],
      benchmark: null,
      stuckOrders: 0,
      staleLeads: 0,
      staleValue: 0,
      ...over,
    };
  };

  it("reports a drop with negative tone", () => {
    const i = overviewInsight(base({}));
    expect(i.headline).toBe("Bookings are down 20% on Jul – Sep 2025 (80 vs 100 cars).");
    expect(i.tone).toBe("negative");
    expect(i.supporting).toEqual([]);
  });

  it("calls flat movement flat", () => {
    const k = base({}).current;
    expect(overviewInsight(base({ current: { ...k, bookedUnits: 101 } })).headline).toMatch(/^Bookings are flat on/);
  });
});

describe("biggestDrop", () => {
  it("finds the weakest pre-order step and ignores delivery", () => {
    // 8 → 6 → 4 → 3 → 2 → 1: delivery (1/2) would be lowest if counted; the first 2/3 step wins.
    expect(biggestDrop(funnel(sampleDataset().leads))).toEqual({ from: "contacted", to: "test_drive", conversion: 2 / 3 });
  });
  it("returns null for an empty funnel", () => {
    expect(biggestDrop(funnel([]))).toBeNull();
  });
});

describe("dataNotes", () => {
  it("summarises the audit findings for the popover", () => {
    const titles = dataNotes(real).map((n) => n.title);
    expect(titles).toContain("Targets are ~7× actual volume");
    expect(titles).toContain("14 leads marked lost without a loss event");
    expect(titles).toContain("42 loss notes contradict the loss reason");
    expect(titles).toContain("55 notes had a template bug");
  });
});
