/** View model for /reps/[id]: one sales officer's results, pipeline and book of leads. */
import { repLeaderboard } from "@/lib/analytics/comparison";
import { OPEN_STAGES, isOpenStage, type OpenStage } from "@/lib/analytics/definitions";
import { createdIn, funnel } from "@/lib/analytics/funnel";
import { overviewInsight, type Insight } from "@/lib/analytics/insights";
import { kpis, ratio, sumBy, type Kpis } from "@/lib/analytics/kpis";
import { toLeadRow } from "@/lib/analytics/lead-rows";
import {
  branchManager,
  compareFunnels,
  salesOfficers,
  summarizeScope,
  type FunnelComparisonStage,
  type ScopeSummary,
} from "@/lib/analytics/scope";
import type { Filters } from "@/lib/filters";
import { sortLeads, type LeadRow } from "@/lib/lead-table";
import type { Branch, Dataset, SalesRep } from "@/lib/types";

export type PipelineStage = { stage: OpenStage; count: number; /** INR. */ value: number };

export type RepView = ScopeSummary & {
  asOf: string;
  filters: Filters;
  rep: SalesRep;
  branch: Branch;
  manager: SalesRep | null;
  /** Branch KPIs for the same range (no targets: reps have none). */
  branchKpis: Kpis;
  /** Rep's share of branch booked revenue. */
  revenueShare: number | null;
  /** Rank by booked revenue among the branch's sales officers. */
  rank: { position: number; of: number };
  /** Stage conversion vs the branch cohort for the same range. */
  funnelVsBranch: FunnelComparisonStage[];
  /** Open leads by current stage, as of AS_OF. */
  pipeline: PipelineStage[];
  /** Every assigned lead, most idle first. */
  leads: LeadRow[];
  insight: Insight;
};

/** null when the id isn't a sales officer (managers own no leads). */
export function buildRepView(ds: Dataset, repId: string, filters: Filters): RepView | null {
  const rep = ds.reps.find((r) => r.id === repId);
  if (!rep || rep.role !== "sales_officer") return null;
  const branch = ds.branches.find((b) => b.id === rep.branch_id);
  if (!branch) return null;
  const { range } = filters;
  const leads = ds.leadsByRep[rep.id];
  const branchLeads = ds.leadsByBranch[branch.id];
  const summary = summarizeScope(ds, leads, null, range);
  const branchKpis = kpis(branchLeads, null, range);
  const board = repLeaderboard(salesOfficers(ds, branch.id), branchLeads, range);
  const open = leads.filter((l) => isOpenStage(l.status));

  return {
    ...summary,
    asOf: ds.asOf,
    filters,
    rep,
    branch,
    manager: branchManager(ds, branch.id),
    branchKpis,
    revenueShare: ratio(summary.kpis.bookedRevenue, branchKpis.bookedRevenue),
    rank: { position: board.findIndex((r) => r.rep.id === rep.id) + 1, of: board.length },
    funnelVsBranch: compareFunnels(summary.funnel, funnel(createdIn(branchLeads, range))),
    pipeline: OPEN_STAGES.map((stage) => {
      const inStage = open.filter((l) => l.status === stage);
      return { stage, count: inStage.length, value: sumBy(inStage, (l) => l.dealValue) };
    }),
    leads: sortLeads(leads.map(toLeadRow), "idle", "desc"),
    insight: overviewInsight({
      range,
      current: summary.kpis,
      previous: summary.previousKpis,
      previousRange: summary.previousRange,
      branches: [],
      benchmark: { kpis: branchKpis, label: `for ${branch.name}` },
      stuckOrders: summary.attention.stuck.count,
      staleLeads: summary.attention.stale.count,
      staleValue: summary.attention.stale.value,
    }),
  };
}
