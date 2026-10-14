import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { buildDataset } from "@/lib/analytics/enrich";
import { sampleDataset } from "@/lib/analytics/fixtures";
import { createdIn, funnel } from "@/lib/analytics/funnel";
import { buildFunnelView } from "@/lib/analytics/funnel-view";
import {
  MIN_LEAK_SAMPLE,
  largestLeaks,
  leakCells,
  leakSentence,
  lossReasonsByStage,
  reconcileFunnel,
  type FunnelReconciliation,
} from "@/lib/analytics/leaks";
import { parseDataset } from "@/lib/analytics/validate";
import { parseFilters } from "@/lib/filters";

const real = buildDataset(parseDataset(rawJson as unknown));
const ALL = { from: "2025-06", to: "2025-12" };

function expectReconciles(r: FunnelReconciliation) {
  for (const s of r.stages) expect(s.movedOn + s.lostHere + s.stillHere).toBe(s.reached);
  const o = r.outcome;
  expect(o.delivered + o.awaiting + o.open + o.lost).toBe(r.total);
}

describe("reconcileFunnel", () => {
  it("accounts for every lead once at each stage (fixture)", () => {
    const r = reconcileFunnel(sampleDataset().leads);
    expectReconciles(r);
    const contacted = r.stages.find((s) => s.stage === "contacted")!;
    // Reached contacted: L1, L2, L4, L6, L7, L8. Moved on: L1, L2, L4, L7.
    // Still here: L6 and L8; L6 is stored as lost but has no loss event, so it is not counted as lost.
    expect(contacted).toMatchObject({ reached: 6, movedOn: 4, lostHere: 0, stillHere: 2, dataIssue: 1 });
    expect(r.outcome).toEqual({ delivered: 1, awaiting: 1, open: 4, openDataIssue: 1, lost: 2 });
  });

  it("reconciles for the company, every branch and every officer (real data)", () => {
    expectReconciles(reconcileFunnel(real.leads));
    for (const b of real.branches) expectReconciles(reconcileFunnel(real.leadsByBranch[b.id]));
    for (const r of real.reps) expectReconciles(reconcileFunnel(real.leadsByRep[r.id]));
  });

  it("matches the existing funnel and data-quality numbers", () => {
    const r = reconcileFunnel(createdIn(real.leads, ALL));
    const f = funnel(createdIn(real.leads, ALL));
    expect(r.stages.map((s) => s.reached)).toEqual(f.stages.map((s) => s.reached));
    expect(r.stages.map((s) => s.lostHere)).toEqual(f.stages.map((s) => s.lostHere));
    expect(r.outcome.lost).toBe(f.lost);
    expect(r.outcome.openDataIssue).toBe(real.dataQuality.statusLostWithoutEvent.length);
    expect(r.stages.reduce((n, s) => n + s.dataIssue, 0)).toBe(14);
  });

  it("handles an empty cohort", () => {
    const r = reconcileFunnel([]);
    expect(r.total).toBe(0);
    expect(r.stages.every((s) => s.reached === 0 && s.lossRate === null)).toBe(true);
  });
});

function recon(stage: { reached: number; lostHere: number }[]): FunnelReconciliation {
  const names = ["new", "contacted", "test_drive", "negotiation", "order_placed", "delivered"] as const;
  return {
    total: stage[0]?.reached ?? 0,
    stages: names.map((name, i) => ({
      stage: name,
      reached: stage[i]?.reached ?? 0,
      movedOn: 0,
      lostHere: stage[i]?.lostHere ?? 0,
      stillHere: 0,
      dataIssue: 0,
      lossRate: stage[i]?.reached ? stage[i].lostHere / stage[i].reached : null,
    })),
    outcome: { delivered: 0, awaiting: 0, open: 0, openDataIssue: 0, lost: 0 },
  };
}

describe("leakCells", () => {
  const company = recon([{ reached: 500, lostHere: 100 }, { reached: 400, lostHere: 80 }, { reached: 300, lostHere: 60 }, { reached: 200, lostHere: 40 }]);

  it("marks a significant excess as a leak and quantifies it", () => {
    const [cell] = leakCells(recon([{ reached: 80, lostHere: 32 }]), company);
    expect(cell.verdict).toBe("leak");
    expect(cell.excessLosses).toBeCloseTo(32 - 80 * 0.2);
    expect(cell.z).toBeCloseTo((0.4 - 0.2) / Math.sqrt((0.2 * 0.8) / 80));
  });

  it("doesn't judge small samples, even with a big gap", () => {
    const cells = leakCells(recon([{ reached: 10, lostHere: 8 }, { reached: MIN_LEAK_SAMPLE - 1, lostHere: 15 }]), company);
    expect(cells[0].verdict).toBe("small_sample");
    expect(cells[1].verdict).toBe("small_sample");
  });

  it("calls modest gaps normal and lower loss rates better", () => {
    const cells = leakCells(recon([{ reached: 100, lostHere: 24 }, { reached: 200, lostHere: 15 }]), company);
    expect(cells[0].verdict).toBe("normal");
    expect(cells[1].verdict).toBe("better");
  });

  it("reports no data for stages nobody reached", () => {
    expect(leakCells(recon([{ reached: 50, lostHere: 50 }]), company)[2].verdict).toBe("no_data");
  });
});

describe("leaks on the real data", () => {
  const view = buildFunnelView(real, parseFilters({ range: "all" }, { months: real.months, branchIds: real.branches.map((b) => b.id) }));

  it("finds Lakeside's leaks and nothing elsewhere", () => {
    expect(view.largest.map((l) => `${l.row.id}:${l.cell.stage}`)).toEqual(["B3:new", "B3:contacted", "B3:test_drive"]);
    expect(leakSentence(view.largest[0])).toBe(
      "Lakeside Toyota loses 39% of leads at New (31 of 79) vs 22% company-wide: about 14 more than expected.",
    );
    const lakesideNegotiation = view.leakRows.find((r) => r.id === "B3")!.cells[3];
    expect(lakesideNegotiation.verdict).toBe("small_sample");
  });

  it("investigates status conflicts by branch", () => {
    const sc = view.statusConflicts;
    expect(sc.leads).toHaveLength(14);
    expect(sc.byBranch[0]).toMatchObject({ conflicts: 7, openLeads: 7, allOpenAreConflicts: true });
    expect(sc.byBranch[0].branch.id).toBe("B3");
    expect(sc.byBranch.filter((b) => b.allOpenAreConflicts).map((b) => b.branch.id)).toEqual(["B3"]);
    expect(sc.createdFrom?.slice(0, 7)).toBe("2025-12");
  });

  it("ranks only meaningful leaks", () => {
    expect(largestLeaks(view.leakRows).every((l) => l.cell.verdict === "leak")).toBe(true);
  });
});

describe("lossReasonsByStage", () => {
  it("splits structured reasons by the stage the lead was lost at", () => {
    expect(lossReasonsByStage(sampleDataset().leads)).toEqual([
      { reason: "Budget constraints", total: 1, byStage: { new: 1, contacted: 0, test_drive: 0, negotiation: 0 } },
      { reason: "Chose competitor brand", total: 1, byStage: { new: 0, contacted: 0, test_drive: 1, negotiation: 0 } },
    ]);
  });

  it("totals the genuine losses only (real data)", () => {
    const rows = lossReasonsByStage(real.leads);
    expect(rows.reduce((n, r) => n + r.total, 0)).toBe(274);
    expect(rows.some((r) => r.reason === "Not recorded")).toBe(false);
  });
});
