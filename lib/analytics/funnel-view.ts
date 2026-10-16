/** View model for /funnel: leak analysis, the status-conflict investigation and the pipeline outlook. */
import { buildForecast, type Forecast } from "@/lib/analytics/forecast";
import { createdIn } from "@/lib/analytics/funnel";
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
import { buildSegments, type Segments } from "@/lib/analytics/segments";
import { isStatusConflict, statusConflictSummary, type StatusConflictSummary } from "@/lib/analytics/status-conflicts";
import { hrefWithFilters, type Filters } from "@/lib/filters";
import type { LeadRow } from "@/lib/lead-table";
import type { Branch, Dataset } from "@/lib/types";

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
  statusConflicts: StatusConflictSummary & { leads: LeadRow[] };
  /** Snapshot of today's open pipeline; not range-filtered. */
  forecast: Forecast;
  /** Lead sources and car models for leads created in the range, in scope. */
  segments: Segments;
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

  const conflictSummary = statusConflictSummary(scopeLeads, branch ? [branch] : ds.branches);

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
      ...conflictSummary,
      leads: scopeLeads.filter(isStatusConflict).map(toLeadRow),
    },
    forecast: buildForecast(ds.leads, scopeLeads),
    segments: buildSegments(ds, range, branch?.id ?? null),
  };
}
