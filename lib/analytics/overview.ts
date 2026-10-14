/**
 * View model for the Overview page: every number the page shows, computed
 * once on the server from the enriched dataset and the URL filters.
 * Components render this; they never compute.
 */
import { repLeaderboard, type RepRow } from "@/lib/analytics/comparison";
import { overviewInsight, type Insight } from "@/lib/analytics/insights";
import { kpis } from "@/lib/analytics/kpis";
import {
  branchRows,
  branchTargets,
  salesOfficers,
  summarizeScope,
  type BranchHealthRow,
  type ScopeSummary,
} from "@/lib/analytics/scope";
import { statusConflictSummary, type StatusConflictSummary } from "@/lib/analytics/status-conflicts";
import type { Filters } from "@/lib/filters";
import type { Branch, Dataset } from "@/lib/types";

export type Overview = ScopeSummary & {
  asOf: string;
  filters: Filters;
  branch: Branch | null;
  /** "All branches" or the branch name. */
  scopeName: string;
  /** Company scope only, highest booked revenue first. */
  branches: BranchHealthRow[];
  /** Branch scope only: that branch's sales officers. */
  reps: RepRow[];
  insight: Insight;
  /** Data-quality finding for the scope; never date-filtered. */
  statusConflicts: StatusConflictSummary;
};

export function buildOverview(ds: Dataset, filters: Filters): Overview {
  const { range, branchId } = filters;
  const branch = ds.branches.find((b) => b.id === branchId) ?? null;
  const leads = branch ? ds.leadsByBranch[branch.id] : ds.leads;
  const targets = branch ? branchTargets(ds, branch.id) : ds.targets;

  const summary = summarizeScope(ds, leads, targets, range);
  const branches = branch ? [] : branchRows(ds, range);
  const reps = branch ? repLeaderboard(salesOfficers(ds, branch.id), leads, range) : [];

  return {
    ...summary,
    asOf: ds.asOf,
    filters,
    branch,
    scopeName: branch?.name ?? "All branches",
    statusConflicts: statusConflictSummary(leads, branch ? [branch] : ds.branches),
    branches,
    reps,
    insight: overviewInsight({
      range,
      current: summary.kpis,
      previous: summary.previousKpis,
      previousRange: summary.previousRange,
      branches: branches.map((b) => ({ name: b.branch.name, kpis: b.kpis, health: b.health })),
      benchmark: branch ? { kpis: kpis(ds.leads, ds.targets, range), label: "company-wide" } : null,
      stuckOrders: summary.attention.stuck.count,
      staleLeads: summary.attention.stale.count,
      staleValue: summary.attention.stale.value,
    }),
  };
}
