import { describe, expect, it } from "vitest";
import { branchComparison, repLeaderboard } from "@/lib/analytics/comparison";
import { sampleDataset } from "@/lib/analytics/fixtures";

const ds = sampleDataset();

describe("branchComparison", () => {
  const rows = branchComparison(ds.branches, ds.leads, ds.targets, { from: "2025-10", to: "2025-11" });

  it("returns a row per branch with scoped KPIs", () => {
    expect(rows.map((r) => r.branch.id)).toEqual(["B1", "B2"]);
    expect(rows[0].kpis.bookedUnits).toBe(2);
    expect(rows[0].kpis.unitAttainment).toBe(0.25);
    expect(rows[1].kpis.bookedUnits).toBe(0);
    expect(rows[1].kpis.unitAttainment).toBe(0);
    expect(rows[1].kpis.winRate).toBe(0);
  });

  it("keeps a branch with no leads as a zero row", () => {
    const [row] = branchComparison([{ id: "B9", name: "Empty", city: "X" }], ds.leads, ds.targets, {
      from: "2025-10",
      to: "2025-11",
    });
    expect(row.kpis.bookedUnits).toBe(0);
    expect(row.kpis.unitAttainment).toBeNull();
  });
});

describe("repLeaderboard", () => {
  const rows = repLeaderboard(ds.reps, ds.leads, { from: "2025-10", to: "2025-12" });
  const row = (id: string) => rows.find((r) => r.rep.id === id)!;

  it("sorts by revenue, then units, then name", () => {
    expect(rows.map((r) => r.rep.id)).toEqual(["R1", "M1", "R3", "R2"]);
  });

  it("computes per-rep outcomes and open work", () => {
    expect(row("R1")).toMatchObject({ bookedUnits: 2, bookedRevenue: 5_000_000, losses: 1 });
    expect(row("R1").winRate).toBeCloseTo(2 / 3);
    expect(row("R2")).toMatchObject({ openLeads: 3, idleLeads: 3, openPipelineValue: 6_000_000 });
    expect(row("R3")).toMatchObject({ openLeads: 1, idleLeads: 0, winRate: 0 });
  });

  it("handles a rep with no leads", () => {
    expect(row("M1")).toMatchObject({ totalLeads: 0, bookedUnits: 0, winRate: null, openLeads: 0 });
  });

  it("respects a custom idle threshold", () => {
    const strict = repLeaderboard(ds.reps, ds.leads, { from: "2025-10", to: "2025-12" }, 20);
    expect(strict.find((r) => r.rep.id === "R2")?.idleLeads).toBe(2); // L4 (30d), L6 (29d)
  });
});
