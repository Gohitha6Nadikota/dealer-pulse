/** View model for /branches/[id]: the Overview, scoped to one branch, plus its team and open book. */
import { repLeaderboard, type RepRow } from "@/lib/analytics/comparison";
import { createdIn, funnel } from "@/lib/analytics/funnel";
import { branchHealth, type Health } from "@/lib/analytics/health";
import { overviewInsight, type Insight } from "@/lib/analytics/insights";
import { kpis, type Kpis } from "@/lib/analytics/kpis";
import { toLeadRow } from "@/lib/analytics/lead-rows";
import {
  branchManager,
  branchTargets,
  compareFunnels,
  salesOfficers,
  summarizeScope,
  type FunnelComparisonStage,
  type ScopeSummary,
} from "@/lib/analytics/scope";
import type { Filters } from "@/lib/filters";
import { sortLeads, type LeadRow } from "@/lib/lead-table";
import type { Branch, Dataset, SalesRep } from "@/lib/types";

export type BranchView = ScopeSummary & {
  asOf: string;
  filters: Filters;
  branch: Branch;
  manager: SalesRep | null;
  health: Health;
  /** Company KPIs for the same range, for comparison. */
  company: Kpis;
  /** Stage conversion vs the company cohort for the same range. */
  funnelVsCompany: FunnelComparisonStage[];
  /** Sales officers, highest booked revenue first. */
  reps: RepRow[];
  /** Open and awaiting-delivery leads, most idle first. Snapshot as of AS_OF. */
  openLeads: LeadRow[];
  insight: Insight;
};

/** null when the id isn't a branch. */
export function buildBranchView(ds: Dataset, branchId: string, filters: Filters): BranchView | null {
  const branch = ds.branches.find((b) => b.id === branchId);
  if (!branch) return null;
  const { range } = filters;
  const leads = ds.leadsByBranch[branch.id];
  const targets = branchTargets(ds, branch.id);
  const summary = summarizeScope(ds, leads, targets, range);
  const company = kpis(ds.leads, ds.targets, range);
  const companyFunnel = funnel(createdIn(ds.leads, range));

  return {
    ...summary,
    asOf: ds.asOf,
    filters,
    branch,
    manager: branchManager(ds, branch.id),
    health: branchHealth({ current: summary.kpis, previous: summary.previousKpis, company }),
    company,
    funnelVsCompany: compareFunnels(summary.funnel, companyFunnel),
    reps: repLeaderboard(salesOfficers(ds, branch.id), leads, range),
    openLeads: sortLeads(
      leads.filter((l) => l.status !== "lost" && l.status !== "delivered").map(toLeadRow),
      "idle",
      "desc",
    ),
    insight: overviewInsight({
      range,
      current: summary.kpis,
      previous: summary.previousKpis,
      previousRange: summary.previousRange,
      branches: [],
      benchmark: { kpis: company, label: "company-wide" },
      stuckOrders: summary.attention.stuck.count,
      staleLeads: summary.attention.stale.count,
      staleValue: summary.attention.stale.value,
    }),
  };
}
