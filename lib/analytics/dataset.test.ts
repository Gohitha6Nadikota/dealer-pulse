/**
 * Runs the real dataset through validation and enrichment and pins the
 * numbers found by scripts/audit-data.ts. If the JSON changes, these fail
 * loudly instead of the dashboard silently shifting.
 */
import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { stuckOrders, staleLeads } from "@/lib/analytics/actions";
import { buildDataset } from "@/lib/analytics/enrich";
import { funnel } from "@/lib/analytics/funnel";
import { kpis } from "@/lib/analytics/kpis";
import { monthlyTrend } from "@/lib/analytics/trend";
import { parseDataset } from "@/lib/analytics/validate";

const ds = buildDataset(parseDataset(rawJson as unknown));
const ALL = { from: "2025-06", to: "2025-12" };

describe("real dataset", () => {
  it("validates and has the expected shape", () => {
    expect(ds.leads).toHaveLength(510);
    expect(ds.branches).toHaveLength(5);
    expect(ds.reps).toHaveLength(30);
    expect(ds.months).toEqual(["2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"]);
  });

  it("uses AS_OF from the latest history entry", () => {
    expect(ds.asOf).toBe("2025-12-31T19:10:00.000Z");
  });

  it("matches the audited data-quality counts", () => {
    expect(ds.dataQuality.statusLostWithoutEvent).toHaveLength(14);
    expect(ds.dataQuality.lossNoteContradictions).toBe(42);
    expect(ds.dataQuality.templatedNotes).toBe(55);
    expect(ds.leads.filter((l) => l.dataQualityIssue === "status_mismatch")).toHaveLength(0);
  });

  it("matches audited bookings per month", () => {
    const trend = monthlyTrend(ds.leads, ds.targets, ALL);
    expect(trend.map((p) => p.bookedUnits)).toEqual([6, 24, 25, 25, 42, 40, 36]);
    expect(trend.map((p) => p.targetUnits)).toEqual([189, 183, 183, 181, 232, 240, 218]);
    expect(trend.map((p) => Math.round((p.avgDaysToDeliver ?? 0) * 10) / 10)).toEqual([
      13.5, 13.9, 14.2, 15, 20.1, 28.9, 13.3,
    ]);
  });

  it("matches company-wide snapshot counts", () => {
    const k = kpis(ds.leads, ds.targets, ALL);
    expect(k.bookedUnits).toBe(198);
    expect(k.losses).toBe(274);
    expect(k.openPipelineCount).toBe(38);
    expect(k.awaitingDeliveryCount).toBe(38);
    // Audit: 25 of the 38 awaiting orders are older than 21 days; 9 open leads idle ≥ 7 days.
    expect(stuckOrders(ds.leads)).toHaveLength(25);
    expect(staleLeads(ds.leads)).toHaveLength(9);
  });

  // Hand-check: Lakeside Toyota (B3) recomputed directly from the raw JSON.
  it("matches a hand-computed branch (B3 Lakeside)", () => {
    const leads = ds.leadsByBranch.B3;
    const k = kpis(leads, ds.targets.filter((t) => t.branch_id === "B3"), ALL);
    expect(leads).toHaveLength(79);
    expect(k).toMatchObject({
      bookedUnits: 10,
      bookedRevenue: 22_970_000,
      losses: 62,
      targetUnits: 264,
      targetRevenue: 578_267_582,
      openPipelineCount: 7,
      openPipelineValue: 15_410_000,
      awaitingDeliveryCount: 4,
      deliveredUnits: 6,
      avgDaysToDeliver: 19,
    });
    expect(k.winRate).toBeCloseTo(10 / 72);
    expect(funnel(leads).stages.map((s) => s.reached)).toEqual([79, 46, 27, 14, 10, 6]);
  });
});
