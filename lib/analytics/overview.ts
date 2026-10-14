/**
 * View model for the Overview page: every number the page shows, computed
 * once on the server from the enriched dataset and the URL filters.
 * Components render this; they never compute.
 */
import {
  delayReasons,
  stalledNegotiations,
  staleLeads,
  stuckOrders,
  type DelayReason,
} from "@/lib/analytics/actions";
import { branchComparison, repLeaderboard, type BranchRow, type RepRow } from "@/lib/analytics/comparison";
import { pointsDelta, relativeDelta, type Delta } from "@/lib/analytics/delta";
import { biggestDrop, createdIn, funnel, type Funnel } from "@/lib/analytics/funnel";
import { branchHealth, type Health } from "@/lib/analytics/health";
import { MIN_BASE_FOR_PERCENT, overviewInsight, type Insight } from "@/lib/analytics/insights";
import { kpis, sumBy, type Kpis } from "@/lib/analytics/kpis";
import type { MonthRange } from "@/lib/analytics/range";
import { monthlyTrend, type TrendPoint } from "@/lib/analytics/trend";
import { previousPeriod, type Filters } from "@/lib/filters";
import type { Branch, Dataset, Lead, SalesRep } from "@/lib/types";

export type BranchHealthRow = BranchRow & { health: Health };

/** A display-ready action item: whose lead, how big, how long, and who owns the next step. */
export type AttentionItem = {
  leadId: string;
  customer: string;
  model: string;
  branchName: string;
  /** INR. */
  dealValue: number;
  /** Days idle, waiting or in stage, depending on the list. */
  days: number;
  owner: { id: string; name: string; role: SalesRep["role"] } | null;
};

export type AttentionList = {
  count: number;
  /** INR. */
  value: number;
  /** Highest-priority items, capped for the summary card. */
  top: AttentionItem[];
};

export type KpiDeltas = {
  bookedRevenue: Delta | null;
  bookedUnits: Delta | null;
  winRate: Delta | null;
  avgDaysToDeliver: Delta | null;
};

export type Overview = {
  asOf: string;
  filters: Filters;
  branch: Branch | null;
  /** "All branches" or the branch name. */
  scopeName: string;
  previousRange: MonthRange | null;
  kpis: Kpis;
  previousKpis: Kpis | null;
  /** Change vs the previous period; null when there is no comparable period. */
  deltas: KpiDeltas;
  /** Every month with data; `inRange` marks the selected ones. */
  trend: (TrendPoint & { inRange: boolean })[];
  /** Cohort: leads created in the selected range. */
  funnel: Funnel;
  funnelDrop: ReturnType<typeof biggestDrop>;
  /** Company scope only, highest booked revenue first. */
  branches: BranchHealthRow[];
  /** Branch scope only: that branch's sales officers. */
  reps: RepRow[];
  attention: {
    stale: AttentionList;
    stuck: AttentionList;
    negotiations: AttentionList;
    delayReasons: DelayReason[];
  };
  insight: Insight;
  /** True when the selection has no bookings, losses or new leads. */
  isEmpty: boolean;
};

export const ATTENTION_PREVIEW = 3;

function attention(
  items: { lead: Lead; days: number }[],
  owner: (lead: Lead) => SalesRep | null,
): AttentionList {
  return {
    count: items.length,
    value: sumBy(items, (i) => i.lead.dealValue),
    top: items.slice(0, ATTENTION_PREVIEW).map(({ lead, days }) => {
      const o = owner(lead);
      return {
        leadId: lead.id,
        customer: lead.customerName,
        model: lead.model,
        branchName: lead.branch.name,
        dealValue: lead.dealValue,
        days,
        owner: o ? { id: o.id, name: o.name, role: o.role } : null,
      };
    }),
  };
}

function kpiDeltas(current: Kpis, previous: Kpis | null): KpiDeltas {
  // Percent changes on single-digit bases mislead, so they are withheld.
  if (!previous || previous.bookedUnits < MIN_BASE_FOR_PERCENT) {
    return { bookedRevenue: null, bookedUnits: null, winRate: null, avgDaysToDeliver: null };
  }
  return {
    bookedRevenue: relativeDelta(current.bookedRevenue, previous.bookedRevenue),
    bookedUnits: relativeDelta(current.bookedUnits, previous.bookedUnits),
    winRate: pointsDelta(current.winRate, previous.winRate),
    avgDaysToDeliver: relativeDelta(current.avgDaysToDeliver, previous.avgDaysToDeliver, {
      higherIsBetter: false,
    }),
  };
}

export function buildOverview(ds: Dataset, filters: Filters): Overview {
  const { range, branchId } = filters;
  const branch = ds.branches.find((b) => b.id === branchId) ?? null;
  const leads = branch ? ds.leadsByBranch[branch.id] : ds.leads;
  const targets = branch ? ds.targets.filter((t) => t.branch_id === branch.id) : ds.targets;
  const previousRange = previousPeriod(range, ds.months);

  const current = kpis(leads, targets, range);
  const previous = previousRange ? kpis(leads, targets, previousRange) : null;
  const company = kpis(ds.leads, ds.targets, range);

  const branches: BranchHealthRow[] = branch
    ? []
    : branchComparison(ds.branches, ds.leads, ds.targets, range).map((row) => {
        const own = ds.leadsByBranch[row.branch.id];
        const ownTargets = ds.targets.filter((t) => t.branch_id === row.branch.id);
        return {
          ...row,
          health: branchHealth({
            current: row.kpis,
            previous: previousRange ? kpis(own, ownTargets, previousRange) : null,
            company,
          }),
        };
      })
      .sort((a, b) => b.kpis.bookedRevenue - a.kpis.bookedRevenue);

  const reps = branch
    ? repLeaderboard(
        ds.reps.filter((r) => r.branch_id === branch.id && r.role === "sales_officer"),
        leads,
        range,
      )
    : [];

  const managers = new Map(
    ds.reps.filter((r) => r.role === "branch_manager").map((r) => [r.branch_id, r]),
  );
  const manager = (lead: Lead) => managers.get(lead.branchId) ?? null;
  const rep = (lead: Lead) => lead.rep;

  const stale = staleLeads(leads);
  const stuck = stuckOrders(leads);
  const cohort = funnel(createdIn(leads, range));

  return {
    asOf: ds.asOf,
    filters,
    branch,
    scopeName: branch?.name ?? "All branches",
    previousRange,
    kpis: current,
    previousKpis: previous,
    deltas: kpiDeltas(current, previous),
    trend: monthlyTrend(leads, targets, { from: ds.months[0], to: ds.months[ds.months.length - 1] }).map(
      (p) => ({ ...p, inRange: p.month >= range.from && p.month <= range.to }),
    ),
    funnel: cohort,
    funnelDrop: biggestDrop(cohort),
    branches,
    reps,
    attention: {
      stale: attention(stale.map((s) => ({ lead: s.lead, days: s.daysIdle })), rep),
      stuck: attention(stuck.map((s) => ({ lead: s.lead, days: s.daysWaiting })), manager),
      negotiations: attention(
        stalledNegotiations(leads).map((n) => ({ lead: n.lead, days: n.daysInStage })),
        rep,
      ),
      delayReasons: delayReasons(leads).reasons.slice(0, ATTENTION_PREVIEW),
    },
    insight: overviewInsight({
      scopeName: branch?.name ?? "the company",
      range,
      current,
      previous,
      previousRange,
      branches: branches.map((b) => ({ name: b.branch.name, kpis: b.kpis, health: b.health })),
      company: branch ? company : null,
      stuckOrders: stuck.length,
      staleLeads: stale.length,
      staleValue: sumBy(stale, (s) => s.valueAtRisk),
    }),
    isEmpty: current.bookedUnits === 0 && current.losses === 0 && cohort.total === 0,
  };
}
