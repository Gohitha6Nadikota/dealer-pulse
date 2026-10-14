import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { buildDataset } from "@/lib/analytics/enrich";
import { sampleDataset } from "@/lib/analytics/fixtures";
import { buildForecast, forecastPipeline, resolvedWindow, stageProbabilities } from "@/lib/analytics/forecast";
import { parseDataset } from "@/lib/analytics/validate";

describe("resolvedWindow", () => {
  it("stops at the first month with an unresolved lead (fixture)", () => {
    // Sep: L1 booked. Oct: L2 booked, L3 lost. Nov: L4 still open.
    expect(resolvedWindow(sampleDataset().leads)).toEqual({ from: "2025-09", to: "2025-10" });
  });
  it("is null when nothing has resolved", () => {
    const open = sampleDataset().leads.filter((l) => l.id === "L5");
    expect(resolvedWindow(open)).toBeNull();
  });
});

describe("forecast arithmetic (fixture)", () => {
  const ds = sampleDataset();
  const f = buildForecast(ds.leads, ds.leads);

  it("derives stage probabilities from resolved history", () => {
    expect(f.window).toEqual({ from: "2025-09", to: "2025-10", leads: 3 });
    expect(f.probabilities.map((p) => p.p)).toEqual([2 / 3, 1, 1, 1]);
  });

  it("sums value × probability across open leads", () => {
    // Open: L4 negotiation 4M (p=1), L5 new 1M (p=2/3), L6 contacted 1M (p=1), L8 contacted 1M (p=1).
    expect(f.pipeline!.expectedOrders).toBeCloseTo(3 + 2 / 3);
    expect(f.pipeline!.expectedValue).toBeCloseTo(6_000_000 + 2_000_000 / 3);
    expect(f.pipeline!.pipelineValue).toBe(7_000_000);
  });

  it("gives a range clamped to what is possible", () => {
    expect(f.pipeline!.ordersRange).toEqual([2, 4]);
    const [lo, hi] = f.pipeline!.valueRange;
    expect(lo).toBeCloseTo(6_000_000 + 2_000_000 / 3 - 1.645 * Math.sqrt(1e12 * (2 / 9)));
    expect(hi).toBe(7_000_000);
  });

  it("shows the outlook without status-conflict leads", () => {
    expect(f.statusConflicts).toBe(1);
    expect(f.withoutStatusConflicts!.openLeads).toBe(3);
    expect(f.withoutStatusConflicts!.expectedOrders).toBeCloseTo(2 + 2 / 3);
  });

  it("returns a zero forecast for an empty pipeline", () => {
    const empty = forecastPipeline([], f.probabilities);
    expect(empty).toMatchObject({ openLeads: 0, expectedOrders: 0, expectedValue: 0, ordersRange: [0, 0] });
  });

  it("falls back to company rates per stage when the scope's history is thin", () => {
    expect(f.probabilities.every((p) => p.source === "company")).toBe(true); // 3 leads < 20
    expect(stageProbabilities([], "own").every((p) => p.p === null)).toBe(true);
  });
});

describe("forecast (real data)", () => {
  const real = buildDataset(parseDataset(rawJson as unknown));
  const f = buildForecast(real.leads, real.leads);

  it("uses Jun–Nov, the fully resolved cohorts", () => {
    expect(f.window).toEqual({ from: "2025-06", to: "2025-11", leads: 435 });
    expect(f.probabilities.map((p) => `${p.ordered}/${p.reached}`)).toEqual(["188/435", "188/338", "188/267", "188/216"]);
  });

  it("covers every open lead with a sensible range", () => {
    const p = f.pipeline!;
    expect(p.openLeads).toBe(38);
    expect(p.expectedOrders).toBeGreaterThan(p.ordersRange[0]);
    expect(p.expectedOrders).toBeLessThan(p.ordersRange[1]);
    expect(p.valueRange[1]).toBeLessThanOrEqual(p.pipelineValue);
  });

  it("uses Lakeside's own rates where it has enough history, company rates otherwise", () => {
    const lakeside = buildForecast(real.leads, real.leadsByBranch.B3);
    expect(lakeside.probabilities.map((p) => p.source)).toEqual(["own", "own", "own", "company"]);
    expect(lakeside.statusConflicts).toBe(7);
    expect(lakeside.withoutStatusConflicts!.openLeads).toBe(0);
  });
});
