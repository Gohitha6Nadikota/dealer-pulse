/** View model for /funnel: leak analysis, the status-conflict investigation and the pipeline outlook. */
import { isOpenStage } from "@/lib/analytics/definitions";
import { buildForecast, type Forecast } from "@/lib/analytics/forecast";
import { createdIn } from "@/lib/analytics/funnel";
import { ratio } from "@/lib/analytics/kpis";
import { toLeadRow } from "@/lib/analytics/lead-rows";
import {
  largestLeaks,
  leakCells,
  lossReasonsByStage,
  reconcileFunnel,
  type FunnelReconciliation,
  type LeakRow,
  type LossReasonByStage,
  type RankedLeak,
} from "@/lib/analytics/leaks";
import { salesOfficers } from "@/lib/analytics/scope";
import { hrefWithFilters, type Filters } from "@/lib/filters";
import type { LeadRow } from "@/lib/lead-table";
import type { Branch, Dataset } from "@/lib/types";

export type StatusConflictBranch = {
  branch: Branch;
  /** Leads stored as lost with no loss event. */
  conflicts: number;
  /** Open leads by history (conflicts included). */
  openLeads: number;
  /** conflicts ÷ openLeads. */
  share: number | null;
  /** Every open lead in the branch is a status conflict. */
  allOpenAreConflicts: boolean;
};

export type FunnelView = {
  asOf: string;
  filters: Filters;
  branch: Branch | null;
  scopeName: string;
  /** Scope cohort: leads created in the range. */
  reconciliation: FunnelReconciliation;
  /** Company cohort for the same range: the benchmark. */
  company: FunnelReconciliation;
  /** Company scope: one row per branch. Branch scope: one row per sales officer. */
  leakRows: LeakRow[];
  largest: RankedLeak[];
  lossReasons: LossReasonByStage[];
  /** Not range-filtered: a data issue is an issue whenever the lead was created. */
  statusConflicts: {
    leads: LeadRow[];
    byBranch: StatusConflictBranch[];
    createdFrom: string | null;
    createdTo: string | null;
    maxDaysIdle: number | null;
  };
  /** Snapshot of today's open pipeline; not range-filtered. */
  forecast: Forecast;
};

export function buildFunnelView(ds: Dataset, filters: Filters): FunnelView {
  const { range } = filters;
  const branch = ds.branches.find((b) => b.id === filters.branchId) ?? null;
  const scopeLeads = branch ? ds.leadsByBranch[branch.id] : ds.leads;
  const company = reconcileFunnel(createdIn(ds.leads, range));

  const leakRows: LeakRow[] = branch
    ? salesOfficers(ds, branch.id).map((rep) => ({
        id: rep.id,
        name: rep.name,
        kind: "rep",
        href: hrefWithFilters(`/reps/${rep.id}`, filters, { branchId: null }),
        cells: leakCells(reconcileFunnel(createdIn(ds.leadsByRep[rep.id], range)), company),
      }))
    : ds.branches.map((b) => ({
        id: b.id,
        name: b.name,
        kind: "branch",
        href: hrefWithFilters(`/branches/${b.id}`, filters, { branchId: null }),
        cells: leakCells(reconcileFunnel(createdIn(ds.leadsByBranch[b.id], range)), company),
      }));

  const conflicts = scopeLeads.filter((l) => l.dataQualityIssue === "status_lost_without_event");
  const created = conflicts.map((l) => l.createdAt).sort();
  const branches = branch ? [branch] : ds.branches;

  return {
    asOf: ds.asOf,
    filters,
    branch,
    scopeName: branch?.name ?? "All branches",
    reconciliation: reconcileFunnel(createdIn(scopeLeads, range)),
    company,
    leakRows,
    largest: largestLeaks(leakRows),
    lossReasons: lossReasonsByStage(createdIn(scopeLeads, range)),
    statusConflicts: {
      leads: conflicts.map(toLeadRow),
      byBranch: branches
        .map((b) => {
          const leads = ds.leadsByBranch[b.id];
          const conflicts = leads.filter((l) => l.dataQualityIssue === "status_lost_without_event").length;
          const openLeads = leads.filter((l) => isOpenStage(l.status)).length;
          return {
            branch: b,
            conflicts,
            openLeads,
            share: ratio(conflicts, openLeads),
            allOpenAreConflicts: conflicts > 0 && conflicts === openLeads,
          };
        })
        .sort((a, b) => b.conflicts - a.conflicts),
      createdFrom: created[0] ?? null,
      createdTo: created[created.length - 1] ?? null,
      maxDaysIdle: conflicts.length ? Math.max(...conflicts.map((l) => l.daysIdle)) : null,
    },
    forecast: buildForecast(ds.leads, scopeLeads),
  };
}
