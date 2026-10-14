/**
 * Shared building blocks for any scope (company, branch, sales officer):
 * the same KPIs, deltas, trend, funnel and action lists, computed from
 * whichever leads and targets the caller passes. Overview, branch and rep
 * view models are thin wrappers over these.
 */
import {
  delayReasons,
  stalledNegotiations,
  staleLeads,
  stuckOrders,
  type DelayReason,
} from "@/lib/analytics/actions";
import { branchComparison, type BranchRow } from "@/lib/analytics/comparison";
import { STAGES, type Stage } from "@/lib/analytics/definitions";
import { pointsDelta, relativeDelta, type Delta } from "@/lib/analytics/delta";
import { biggestDrop, createdIn, funnel, type Funnel } from "@/lib/analytics/funnel";
import { branchHealth, type Health } from "@/lib/analytics/health";
import { MIN_BASE_FOR_PERCENT } from "@/lib/analytics/insights";
import { kpis, sumBy, type Kpis } from "@/lib/analytics/kpis";
import type { MonthRange } from "@/lib/analytics/range";
import { monthlyTrend, type TrendPoint } from "@/lib/analytics/trend";
import { previousPeriod } from "@/lib/filters";
import type { Dataset, Lead, SalesRep, Target } from "@/lib/types";

export const ATTENTION_PREVIEW = 3;

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

export type Attention = {
  stale: AttentionList;
  stuck: AttentionList;
  negotiations: AttentionList;
  delayReasons: DelayReason[];
};

export type KpiDeltas = {
  bookedRevenue: Delta | null;
  bookedUnits: Delta | null;
  winRate: Delta | null;
  avgDaysToDeliver: Delta | null;
};

export type ScopeSummary = {
  range: MonthRange;
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
  attention: Attention;
  /** True when the selection has no bookings, losses or new leads. */
  isEmpty: boolean;
};

export function kpiDeltas(current: Kpis, previous: Kpis | null): KpiDeltas {
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

export function branchManager(ds: Dataset, branchId: string): SalesRep | null {
  return ds.reps.find((r) => r.branch_id === branchId && r.role === "branch_manager") ?? null;
}

export function salesOfficers(ds: Dataset, branchId: string): SalesRep[] {
  return ds.reps.filter((r) => r.branch_id === branchId && r.role === "sales_officer");
}

function attentionList(
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

/**
 * Action lists for the given leads. Idle leads and negotiations belong to the
 * assigned sales officer; delivery chasing belongs to the branch manager.
 */
export function attentionFor(ds: Dataset, leads: Lead[]): Attention {
  const managers = new Map(
    ds.reps.filter((r) => r.role === "branch_manager").map((r) => [r.branch_id, r]),
  );
  const manager = (lead: Lead) => managers.get(lead.branchId) ?? null;
  const rep = (lead: Lead) => lead.rep;
  return {
    stale: attentionList(staleLeads(leads).map((s) => ({ lead: s.lead, days: s.daysIdle })), rep),
    stuck: attentionList(stuckOrders(leads).map((s) => ({ lead: s.lead, days: s.daysWaiting })), manager),
    negotiations: attentionList(
      stalledNegotiations(leads).map((n) => ({ lead: n.lead, days: n.daysInStage })),
      rep,
    ),
    delayReasons: delayReasons(leads).reasons.slice(0, ATTENTION_PREVIEW),
  };
}

/** Everything a scope page needs, for the given leads and targets (null: no targets). */
export function summarizeScope(
  ds: Dataset,
  leads: Lead[],
  targets: Target[] | null,
  range: MonthRange,
): ScopeSummary {
  const previousRange = previousPeriod(range, ds.months);
  const current = kpis(leads, targets, range);
  const previous = previousRange ? kpis(leads, targets, previousRange) : null;
  const cohort = funnel(createdIn(leads, range));
  return {
    range,
    previousRange,
    kpis: current,
    previousKpis: previous,
    deltas: kpiDeltas(current, previous),
    trend: monthlyTrend(leads, targets, { from: ds.months[0], to: ds.months[ds.months.length - 1] }).map(
      (p) => ({ ...p, inRange: p.month >= range.from && p.month <= range.to }),
    ),
    funnel: cohort,
    funnelDrop: biggestDrop(cohort),
    attention: attentionFor(ds, leads),
    isEmpty: current.bookedUnits === 0 && current.losses === 0 && cohort.total === 0,
  };
}

export function branchTargets(ds: Dataset, branchId: string): Target[] {
  return ds.targets.filter((t) => t.branch_id === branchId);
}

/** Every branch with KPIs and health for the range, highest booked revenue first. */
export function branchRows(ds: Dataset, range: MonthRange): BranchHealthRow[] {
  const previousRange = previousPeriod(range, ds.months);
  const company = kpis(ds.leads, ds.targets, range);
  return branchComparison(ds.branches, ds.leads, ds.targets, range)
    .map((row) => ({
      ...row,
      health: branchHealth({
        current: row.kpis,
        previous: previousRange
          ? kpis(ds.leadsByBranch[row.branch.id], branchTargets(ds, row.branch.id), previousRange)
          : null,
        company,
      }),
    }))
    .sort((a, b) => b.kpis.bookedRevenue - a.kpis.bookedRevenue);
}

/** A stage converting this many points below its benchmark is flagged. */
export const FUNNEL_GAP_ALERT_POINTS = 5;

export type FunnelComparisonStage = {
  stage: Stage;
  conversion: number | null;
  benchmark: number | null;
  /** conversion − benchmark in percentage points; null if either is missing. */
  gapPoints: number | null;
  /** True when the gap is at least FUNNEL_GAP_ALERT_POINTS below the benchmark. */
  belowBenchmark: boolean;
};

/** Stage-by-stage conversion against a benchmark funnel (company or branch). */
export function compareFunnels(subject: Funnel, benchmark: Funnel): FunnelComparisonStage[] {
  return STAGES.map((stage, i) => {
    const conversion = subject.stages[i].conversion;
    const bench = benchmark.stages[i].conversion;
    const gapPoints = conversion === null || bench === null ? null : Math.round((conversion - bench) * 100);
    return {
      stage,
      conversion,
      benchmark: bench,
      gapPoints,
      belowBenchmark: gapPoints !== null && gapPoints <= -FUNNEL_GAP_ALERT_POINTS,
    };
  });
}
