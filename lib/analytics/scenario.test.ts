import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { buildDataset } from "@/lib/analytics/enrich";
import { buildForecast, type StageProbability } from "@/lib/analytics/forecast";
import { buildFunnelView } from "@/lib/analytics/funnel-view";
import {
  NO_ADJUSTMENTS,
  STEP_ADJUSTMENT_RANGE,
  adjustmentBetween,
  runScenario,
  scenarioProbabilities,
  stepRatesFromProbabilities,
  type Adjustments,
  type ScenarioInputs,
} from "@/lib/analytics/scenario";
import { parseDataset } from "@/lib/analytics/validate";
import { parseFilters } from "@/lib/filters";

const real = buildDataset(parseDataset(rawJson as unknown));
const ctx = { months: real.months, branchIds: real.branches.map((b) => b.id) };
const view = (q: Record<string, string>) => buildFunnelView(real, parseFilters({ range: "all", ...q }, ctx));
const company = view({}).scenario!;
const adjust = (step: number, by: number): Adjustments => ({
  steps: NO_ADJUSTMENTS.steps.map((_, i) => (i === step ? by : 0)),
  volume: 0,
});

describe("baseline equals the Pipeline outlook", () => {
  for (const scope of [null, ...real.branches.map((b) => b.id)]) {
    it(`matches the outlook exactly for ${scope ?? "the company"}`, () => {
      const v = view(scope ? { branch: scope } : {});
      const base = runScenario(v.scenario!, NO_ADJUSTMENTS);
      const clean = runScenario(v.scenario!, NO_ADJUSTMENTS, { includeConflicts: false });
      for (const p of v.forecast.probabilities) expect(base.probabilities[p.stage]).toBe(p.p);
      expect(base.pipeline.expectedOrders).toBeCloseTo(v.forecast.pipeline!.expectedOrders, 10);
      expect(base.pipeline.expectedValue).toBeCloseTo(v.forecast.pipeline!.expectedValue, 2);
      expect(base.pipeline.ordersRange).toEqual(v.forecast.pipeline!.ordersRange);
      expect(clean.pipeline.expectedOrders).toBeCloseTo(v.forecast.withoutStatusConflicts!.expectedOrders, 10);
    });
  }
});

describe("step rates", () => {
  it("are the real step conversions for the company", () => {
    expect(company.steps.map((s) => s.rate)).toEqual([338 / 435, 267 / 338, 216 / 267, 188 / 216].map((r) => expect.closeTo(r, 12)));
    // At company scope the company's history is the scope's own history.
    expect(company.steps.every((s) => s.source === "own")).toBe(true);
  });

  it("multiply out to the lead-to-order rate (no stage is ever skipped)", () => {
    const product = company.steps.reduce((acc, s) => acc * s.rate!, 1);
    expect(product).toBeCloseTo(188 / 435, 12);
  });

  it("are labelled mixed where a branch uses its own rate on one side and the company's on the other", () => {
    const lakeside = view({ branch: "B3" }).scenario!;
    expect(lakeside.steps.map((s) => s.source)).toEqual(["own", "own", "mixed", "company"]);
  });

  it("are null without history", () => {
    const empty: StageProbability[] = (["new", "contacted", "test_drive", "negotiation"] as const).map((stage) => ({
      stage, source: "own", reached: 0, ordered: 0, p: null, medianDaysToOrder: null,
    }));
    expect(stepRatesFromProbabilities(empty).map((s) => s.rate)).toEqual([null, null, null, null]);
  });
});

describe("adjustments", () => {
  it("+10% on Test drive → Negotiation lifts only the stages before it", () => {
    const base = runScenario(company, NO_ADJUSTMENTS);
    const r = runScenario(company, adjust(2, 0.1));
    expect(r.probabilities.new).toBeCloseTo(base.probabilities.new! * 1.1, 12);
    expect(r.probabilities.contacted).toBeCloseTo(base.probabilities.contacted! * 1.1, 12);
    expect(r.probabilities.test_drive).toBeCloseTo(base.probabilities.test_drive! * 1.1, 12);
    expect(r.probabilities.negotiation).toBe(base.probabilities.negotiation);
    expect(r.leadToOrder).toBeCloseTo((188 / 435) * 1.1, 12);
    expect(r.pipeline.expectedOrders - base.pipeline.expectedOrders).toBeCloseTo(1.9, 1);
  });

  it("New → Contacted only affects New leads", () => {
    const base = runScenario(company, NO_ADJUSTMENTS);
    const r = runScenario(company, adjust(0, 0.2));
    expect(r.probabilities.new).toBeCloseTo(base.probabilities.new! * 1.2, 12);
    expect(r.probabilities.contacted).toBe(base.probabilities.contacted);
  });

  it("caps a step at 100%", () => {
    const r = runScenario(company, adjust(3, 1)); // 87% × 2 → capped at 100%
    expect(r.rates[3]).toBe(1);
    expect(r.probabilities.negotiation).toBe(1);
    expect(Object.values(r.probabilities).every((p) => p! <= 1)).toBe(true);
  });

  it("never lowers expected orders when a rate goes up, and lowers them when it goes down", () => {
    const base = runScenario(company, NO_ADJUSTMENTS).pipeline.expectedOrders;
    for (let step = 0; step < 4; step++) {
      expect(runScenario(company, adjust(step, 0.15)).pipeline.expectedOrders).toBeGreaterThanOrEqual(base);
      expect(runScenario(company, adjust(step, -0.15)).pipeline.expectedOrders).toBeLessThan(base);
    }
  });

  it("scales the monthly run-rate with lead volume and conversion", () => {
    const base = runScenario(company, NO_ADJUSTMENTS);
    expect(company.monthlyVolume).toBeCloseTo((90 + 95 + 75) / 3, 12);
    expect(base.monthlyOrders).toBeCloseTo(company.monthlyVolume * (188 / 435), 12);
    expect(base.monthlyRevenue).toBeCloseTo(base.monthlyOrders! * company.avgDealValue!, 4);
    const more = runScenario(company, { ...NO_ADJUSTMENTS, volume: 0.2 });
    expect(more.monthlyLeads).toBeCloseTo(company.monthlyVolume * 1.2, 12);
    expect(more.monthlyOrders).toBeCloseTo(base.monthlyOrders! * 1.2, 12);
    expect(runScenario(company, { ...NO_ADJUSTMENTS, volume: 5 }).monthlyLeads).toBeCloseTo(company.monthlyVolume * 1.5, 12);
  });

  it("uses the real average booked deal value", () => {
    const booked = real.leads.filter((l) => l.bookedAt !== null);
    expect(company.avgDealValue).toBeCloseTo(booked.reduce((n, l) => n + l.dealValue, 0) / booked.length, 4);
  });
});

describe("presets", () => {
  it("company scope offers only 'match best branch', which never lowers a rate", () => {
    expect(company.presets.map((p) => p.id)).toEqual(["match_best"]);
    expect(company.presets[0].adjustments.steps.every((d) => d >= 0)).toBe(true);
  });

  it("'match company rates' turns Lakeside's lead-to-order rate into the company's", () => {
    const lakeside = view({ branch: "B3" }).scenario!;
    const preset = lakeside.presets.find((p) => p.id === "match_company")!;
    const r = runScenario(lakeside, preset.adjustments);
    expect(runScenario(lakeside, NO_ADJUSTMENTS).leadToOrder).toBeCloseTo(10 / 64, 12);
    expect(r.leadToOrder).toBeCloseTo(188 / 435, 10);
    expect(r.pipeline.expectedOrders).toBeGreaterThan(runScenario(lakeside, NO_ADJUSTMENTS).pipeline.expectedOrders);
  });

  it("keeps adjustments within the slider range", () => {
    expect(adjustmentBetween(0.2, 0.9)).toBe(STEP_ADJUSTMENT_RANGE.max);
    expect(adjustmentBetween(0.9, 0.1)).toBe(STEP_ADJUSTMENT_RANGE.min);
    expect(adjustmentBetween(null, 0.5)).toBeNull();
    expect(adjustmentBetween(0.5, null)).toBeNull();
  });
});

describe("edge cases", () => {
  it("handles an empty pipeline and missing history", () => {
    const inputs: ScenarioInputs = {
      steps: company.steps.map((s) => ({ ...s, rate: null })),
      baseProbabilities: { new: null, contacted: null, test_drive: null, negotiation: null },
      open: [],
      monthlyVolume: 0,
      volumeWindow: { from: "2025-10", to: "2025-12" },
      avgDealValue: null,
      presets: [],
    };
    const r = runScenario(inputs, adjust(1, 0.3));
    expect(r.leadToOrder).toBeNull();
    expect(r.monthlyOrders).toBeNull();
    expect(r.monthlyRevenue).toBeNull();
    expect(r.pipeline).toMatchObject({ openLeads: 0, expectedOrders: 0, expectedValue: 0, ordersRange: [0, 0] });
  });

  it("leaves probabilities alone when a step has no rate", () => {
    const steps = company.steps.map((s, i) => (i === 2 ? { ...s, rate: null } : s));
    const p = scenarioProbabilities(steps, company.baseProbabilities, adjust(2, 0.5));
    expect(p.new).toBe(company.baseProbabilities.new);
  });

  it("is computed from the same forecast the outlook shows", () => {
    expect(buildForecast(real.leads, real.leads).probabilities.map((p) => p.p)).toEqual(
      Object.values(company.baseProbabilities),
    );
  });
});
