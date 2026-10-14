import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { actionItems, filterActions } from "@/lib/analytics/action-center";
import { buildActionCenter } from "@/lib/analytics/actions-view";
import { buildBranchView } from "@/lib/analytics/branch-view";
import { buildDataset } from "@/lib/analytics/enrich";
import { rawDataset, rawLead, sampleDataset } from "@/lib/analytics/fixtures";
import { createdIn, funnel } from "@/lib/analytics/funnel";
import { kpis } from "@/lib/analytics/kpis";
import { reconcileFunnel } from "@/lib/analytics/leaks";
import { buildOverview } from "@/lib/analytics/overview";
import { buildRepView } from "@/lib/analytics/rep-view";
import { isStatusConflict, statusConflictNotice, statusConflictSummary } from "@/lib/analytics/status-conflicts";
import { parseDataset } from "@/lib/analytics/validate";
import { parseFilters } from "@/lib/filters";

const real = buildDataset(parseDataset(rawJson as unknown));
const ctx = { months: real.months, branchIds: real.branches.map((b) => b.id) };
const company = statusConflictSummary(real.leads, real.branches);
const lakeside = real.branches.find((b) => b.id === "B3")!;

describe("statusConflictSummary (real data)", () => {
  it("finds the 14 audited records, the same set enrich.ts flags", () => {
    expect(company.count).toBe(14);
    expect([...company.leadIds].sort()).toEqual([...real.dataQuality.statusLostWithoutEvent].sort());
    expect(company.openLeads).toBe(38);
    expect(company.allOpenAreConflicts).toBe(false);
  });

  it("describes them: created in December (UTC), idle at most 11 days", () => {
    expect(company.createdFrom?.slice(0, 10)).toBe("2025-12-06");
    expect(company.createdTo?.slice(0, 10)).toBe("2025-12-31");
    expect(company.maxDaysIdle).toBe(11);
  });

  it("marks Lakeside, and only Lakeside, as fully affected", () => {
    expect(company.fullyAffected.map((b) => b.branch.id)).toEqual(["B3"]);
    expect(company.byBranch[0]).toMatchObject({ conflicts: 7, openLeads: 7, share: 1, allOpenAreConflicts: true });
    expect(company.byBranch.reduce((n, b) => n + b.conflicts, 0)).toBe(14);
  });

  it("handles a dataset with no conflicts", () => {
    const clean = buildDataset(rawDataset({ leads: [rawLead("L1", [["new", "2025-12-01T00:00:00Z"]])] }));
    const s = statusConflictSummary(clean.leads, clean.branches);
    expect(s).toMatchObject({ count: 0, leadIds: [], fullyAffected: [], createdFrom: null, maxDaysIdle: null });
    expect(statusConflictNotice(s, null)).toBeNull();
    expect(statusConflictSummary([], []).count).toBe(0);
  });
});

describe("statusConflictNotice wording", () => {
  it("company: the 14 leads and the fully affected branch", () => {
    expect(statusConflictNotice(company, null)).toEqual({
      title: "CRM data quality issue — 14 leads",
      body: "14 leads are marked as lost without a recorded loss event or loss reason. They are treated as open in analytics to avoid misreporting genuine losses.",
      notes: ["All 7 of Lakeside Toyota's open leads are affected."],
    });
  });

  it("Lakeside: reflects the data layer's all-open-affected result with a caution", () => {
    const view = buildBranchView(real, "B3", parseFilters({}, ctx))!;
    expect(view.statusConflicts.allOpenAreConflicts).toBe(true);
    const notice = statusConflictNotice(view.statusConflicts, lakeside.name)!;
    expect(notice.title).toBe("CRM data quality issue — 7 leads");
    expect(notice.notes).toEqual([
      "All 7 of Lakeside Toyota's open leads are affected, so treat its in-progress CRM statuses with caution until they are corrected.",
    ]);
  });

  it("partly affected branch and singular wording", () => {
    const central = buildBranchView(real, "B4", parseFilters({}, ctx))!;
    expect(statusConflictNotice(central.statusConflicts, "Central Toyota")!.notes).toEqual(["3 of 11 open leads are affected."]);
    const one = statusConflictSummary(real.leads.filter((l) => l.id === company.leadIds[0]), real.branches);
    expect(statusConflictNotice(one, null)!.body).toMatch(/^1 lead is marked as lost .* It is treated as open/);
    expect(statusConflictNotice(one, null)!.title).toBe("CRM data quality issue — 1 lead");
  });

  it("no notice for a branch without conflicts", () => {
    const eastside = buildBranchView(real, "B5", parseFilters({}, ctx))!;
    expect(statusConflictNotice(eastside.statusConflicts, "Eastside Toyota")).toBeNull();
  });

  it("never claims the leads are active or the data was lost", () => {
    const text = JSON.stringify(statusConflictNotice(company, null));
    expect(text).not.toMatch(/active|fraud|deleted|data loss/i);
  });
});

describe("the finding ignores the reporting date range", () => {
  it("stays at 14 on the Overview for every range", () => {
    for (const params of [{}, { range: "6m" }, { range: "all" }, { from: "2025-07", to: "2025-08" }, { from: "2025-06", to: "2025-06" }]) {
      const o = buildOverview(real, parseFilters(params, ctx));
      expect(o.statusConflicts.count).toBe(14);
      expect(o.statusConflicts.fullyAffected.map((b) => b.branch.id)).toEqual(["B3"]);
    }
  });

  it("stays on the branch and officer pages for a range before the leads existed", () => {
    const early = parseFilters({ from: "2025-06", to: "2025-07" }, ctx);
    expect(buildBranchView(real, "B3", early)!.statusConflicts.count).toBe(7);
    const officer = real.leads.find((l) => l.id === company.leadIds[0])!.repId;
    expect(buildRepView(real, officer, early)!.statusConflicts.count).toBeGreaterThan(0);
  });

  it("only the funnel cohort count follows the range", () => {
    expect(buildOverview(real, parseFilters({ range: "all" }, ctx)).funnelConflicts).toBe(14);
    expect(buildOverview(real, parseFilters({ from: "2025-07", to: "2025-09" }, ctx)).funnelConflicts).toBe(0);
  });
});

describe("Action Center status_conflict filter", () => {
  const filters = parseFilters({}, ctx);

  it("returns exactly the 14 affected leads, one row each", () => {
    const view = buildActionCenter(real, filters, { reason: "status_conflict", severity: null, ownerId: null });
    expect(view.items.map((i) => i.leadId).sort()).toEqual([...company.leadIds].sort());
    expect(new Set(view.items.map((i) => i.leadId)).size).toBe(view.items.length);
    expect(view.statusConflicts.count).toBe(14);
  });

  it("keeps other reasons, owners and severities on those rows", () => {
    const items = filterActions(actionItems(real, real.leads), { branchId: null, reason: "status_conflict", severity: null, ownerId: null });
    const withOther = items.filter((i) => i.reasons.length > 1);
    expect(withOther.length).toBeGreaterThan(0);
    expect(withOther.every((i) => i.reasons.at(-1)?.reason === "status_conflict")).toBe(true);
    expect(items.every((i) => i.owner.role === "sales_officer")).toBe(true);
    expect(items.filter((i) => i.severity === "review")).toHaveLength(11);
  });

  it("scopes to a branch", () => {
    const view = buildActionCenter(real, { ...filters, branchId: "B3" }, { reason: "status_conflict", severity: null, ownerId: null });
    expect(view.items).toHaveLength(7);
    expect(view.statusConflicts.fullyAffected.map((b) => b.branch.id)).toEqual(["B3"]);
  });
});

describe("conflicts are never counted as losses", () => {
  const all = { from: "2025-06", to: "2025-12" };
  const conflicted = real.leads.filter(isStatusConflict);

  it("have no loss timestamp or reason and an open status", () => {
    expect(conflicted.every((l) => l.lostAt === null && l.lostReason === null && l.status !== "lost")).toBe(true);
  });

  it("are excluded from KPI losses, funnel losses and loss reasons", () => {
    expect(kpis(real.leads, real.targets, all).losses).toBe(274);
    expect(funnel(createdIn(real.leads, all)).lost).toBe(274);
    expect(kpis(conflicted, null, all).losses).toBe(0);
    expect(funnel(conflicted).lossReasons).toEqual([]);
  });

  it("sit in 'still here', and reconciliation still holds", () => {
    const r = reconcileFunnel(createdIn(real.leads, all));
    expect(r.stages.reduce((n, s) => n + s.dataIssue, 0)).toBe(14);
    expect(r.stages.reduce((n, s) => n + s.lostHere, 0)).toBe(274);
    for (const s of r.stages) expect(s.movedOn + s.lostHere + s.stillHere).toBe(s.reached);
    expect(r.outcome.lost + r.outcome.open + r.outcome.awaiting + r.outcome.delivered).toBe(r.total);
  });

  it("carry the flag through to lead rows (fixture)", () => {
    const ds = sampleDataset();
    expect(buildOverview(ds, { preset: "all", range: { from: "2025-09", to: "2025-12" }, branchId: null }).statusConflicts.leadIds).toEqual(["L6"]);
  });
});
