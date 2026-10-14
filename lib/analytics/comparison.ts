/** Side-by-side rows for branches and reps, built from the same KPI functions. */
import { THRESHOLDS, isOpenStage } from "@/lib/analytics/definitions";
import { kpis, type Kpis } from "@/lib/analytics/kpis";
import type { MonthRange } from "@/lib/analytics/range";
import type { Branch, Lead, SalesRep, Target } from "@/lib/types";

export type BranchRow = { branch: Branch; kpis: Kpis };

/** One row per branch, in the order given. Branches with no leads get zero rows, not omissions. */
export function branchComparison(
  branches: Branch[],
  leads: Lead[],
  targets: Target[],
  range: MonthRange,
): BranchRow[] {
  return branches.map((branch) => ({
    branch,
    kpis: kpis(
      leads.filter((l) => l.branchId === branch.id),
      targets.filter((t) => t.branch_id === branch.id),
      range,
    ),
  }));
}

export type RepRow = {
  rep: SalesRep;
  totalLeads: number;
  bookedUnits: number;
  /** INR. */
  bookedRevenue: number;
  wins: number;
  losses: number;
  winRate: number | null;
  /** Snapshot as of AS_OF. */
  openLeads: number;
  /** Open leads idle for at least `idleThresholdDays`. */
  idleLeads: number;
  /** INR. */
  openPipelineValue: number;
};

/**
 * One row per rep given (callers usually pass sales officers only; branch
 * managers own no leads). Sorted by booked revenue, then units, then name.
 */
export function repLeaderboard(
  reps: SalesRep[],
  leads: Lead[],
  range: MonthRange,
  idleThresholdDays: number = THRESHOLDS.staleLeadDays,
): RepRow[] {
  return reps
    .map((rep): RepRow => {
      const own = leads.filter((l) => l.repId === rep.id);
      const k = kpis(own, null, range);
      const open = own.filter((l) => isOpenStage(l.status));
      return {
        rep,
        totalLeads: own.length,
        bookedUnits: k.bookedUnits,
        bookedRevenue: k.bookedRevenue,
        wins: k.wins,
        losses: k.losses,
        winRate: k.winRate,
        openLeads: open.length,
        idleLeads: open.filter((l) => l.daysIdle >= idleThresholdDays).length,
        openPipelineValue: k.openPipelineValue,
      };
    })
    .sort(
      (a, b) =>
        b.bookedRevenue - a.bookedRevenue ||
        b.bookedUnits - a.bookedUnits ||
        a.rep.name.localeCompare(b.rep.name),
    );
}
