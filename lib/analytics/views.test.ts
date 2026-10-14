/** Branch and sales-officer view models, plus shared scope helpers and route id checks. */
import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { buildBranchView } from "@/lib/analytics/branch-view";
import { buildDataset } from "@/lib/analytics/enrich";
import { sampleDataset } from "@/lib/analytics/fixtures";
import { funnel } from "@/lib/analytics/funnel";
import { buildRepView } from "@/lib/analytics/rep-view";
import { attentionFor, branchRows, compareFunnels } from "@/lib/analytics/scope";
import { parseDataset } from "@/lib/analytics/validate";
import { parseFilters, parseRangeFilters, rangeQuery } from "@/lib/filters";
import { detailRouteExists } from "@/lib/route-ids";

const real = buildDataset(parseDataset(rawJson as unknown));
const ctx = { months: real.months, branchIds: real.branches.map((b) => b.id) };
const defaults = parseFilters({}, ctx);

describe("buildBranchView", () => {
  const view = buildBranchView(real, "B3", defaults)!;

  it("returns null for an unknown branch", () => {
    expect(buildBranchView(real, "B9", defaults)).toBeNull();
  });

  it("scopes KPIs to the branch and matches the Overview's branch numbers", () => {
    expect(view.branch.name).toBe("Lakeside Toyota");
    expect(view.kpis.bookedUnits).toBe(5);
    const row = branchRows(real, defaults.range).find((r) => r.branch.id === "B3")!;
    expect(view.kpis).toEqual(row.kpis);
    expect(view.health).toEqual(row.health);
  });

  it("names the manager and lists only this branch's sales officers", () => {
    expect(view.manager?.role).toBe("branch_manager");
    expect(view.reps.length).toBeGreaterThan(0);
    expect(view.reps.every((r) => r.rep.branch_id === "B3" && r.rep.role === "sales_officer")).toBe(true);
  });

  it("lists open and awaiting leads only, as of AS_OF", () => {
    expect(view.openLeads.length).toBe(view.kpis.openPipelineCount + view.kpis.awaitingDeliveryCount);
    expect(view.openLeads.every((r) => r.bucket === "open" || r.bucket === "awaiting")).toBe(true);
  });

  it("compares its funnel with the company", () => {
    expect(view.funnelVsCompany).toHaveLength(6);
    expect(view.insight.headline).toMatch(/company-wide/);
  });
});

describe("buildRepView", () => {
  const officer = real.reps.find((r) => r.branch_id === "B3" && r.role === "sales_officer")!;
  const view = buildRepView(real, officer.id, defaults)!;

  it("returns null for unknown ids and for branch managers", () => {
    expect(buildRepView(real, "SR999", defaults)).toBeNull();
    const manager = real.reps.find((r) => r.role === "branch_manager")!;
    expect(buildRepView(real, manager.id, defaults)).toBeNull();
  });

  it("covers every assigned lead and has no targets", () => {
    expect(view.leads).toHaveLength(real.leadsByRep[officer.id].length);
    expect(view.kpis.targetUnits).toBeNull();
    expect(view.trend.every((p) => p.targetUnits === null)).toBe(true);
  });

  it("ranks the officer within the branch and reports revenue share", () => {
    const officers = real.reps.filter((r) => r.branch_id === "B3" && r.role === "sales_officer");
    expect(view.rank.of).toBe(officers.length);
    expect(view.rank.position).toBeGreaterThanOrEqual(1);
    expect(view.rank.position).toBeLessThanOrEqual(view.rank.of);
    if (view.revenueShare !== null) expect(view.revenueShare).toBeLessThanOrEqual(1);
  });

  it("splits the open pipeline by stage consistently with the KPI", () => {
    expect(view.pipeline.map((p) => p.stage)).toEqual(["new", "contacted", "test_drive", "negotiation"]);
    expect(view.pipeline.reduce((n, p) => n + p.count, 0)).toBe(view.kpis.openPipelineCount);
    expect(view.pipeline.reduce((n, p) => n + p.value, 0)).toBe(view.kpis.openPipelineValue);
  });

  it("works for a rep with no activity in the range (fixture)", () => {
    const ds = sampleDataset();
    const v = buildRepView(ds, "R3", { preset: "custom", range: { from: "2025-10", to: "2025-10" }, branchId: null })!;
    expect(v.kpis.bookedUnits).toBe(0);
    expect(v.revenueShare).toBeNull();
    expect(v.isEmpty).toBe(true);
  });
});

describe("compareFunnels", () => {
  it("reports gaps in points and flags stages well below the benchmark", () => {
    const ds = sampleDataset();
    const cmp = compareFunnels(funnel(ds.leadsByRep.R2), funnel(ds.leads));
    // R2: 3 new → 2 contacted (67%) vs all: 8 → 6 (75%)
    expect(cmp[1]).toMatchObject({ stage: "contacted", gapPoints: -8, belowBenchmark: true });
    expect(cmp[0]).toMatchObject({ conversion: null, gapPoints: null, belowBenchmark: false });
  });
});

describe("attentionFor", () => {
  it("routes delivery chasing to the branch manager and follow-ups to the officer", () => {
    const ds = sampleDataset();
    const a = attentionFor(ds, ds.leads);
    expect(a.stuck.top[0].owner).toMatchObject({ id: "M1", role: "branch_manager" });
    expect(a.stale.top[0].owner).toMatchObject({ id: "R2", role: "sales_officer" });
  });
});

describe("route helpers", () => {
  it("validates detail ids from the dataset", () => {
    expect(detailRouteExists("/branches/B3")).toBe(true);
    expect(detailRouteExists("/branches/B9")).toBe(false);
    expect(detailRouteExists("/branches/b3")).toBe(false);
    const officer = real.reps.find((r) => r.role === "sales_officer")!;
    const manager = real.reps.find((r) => r.role === "branch_manager")!;
    expect(detailRouteExists(`/reps/${officer.id}`)).toBe(true);
    expect(detailRouteExists(`/reps/${manager.id}`)).toBe(false);
    expect(detailRouteExists("/branches")).toBeNull();
    expect(detailRouteExists("/")).toBeNull();
  });

  it("drops the branch filter on scoped pages but keeps the range", () => {
    expect(parseRangeFilters({ range: "6m", branch: "B2" }, ctx)).toMatchObject({ preset: "6m", branchId: null });
  });

  it("keeps only range params for cross-section nav links", () => {
    expect(rangeQuery("range=6m&branch=B2")).toBe("?range=6m");
    expect(rangeQuery("from=2025-07&to=2025-09&branch=B1")).toBe("?from=2025-07&to=2025-09");
    expect(rangeQuery("branch=B1")).toBe("");
  });
});
