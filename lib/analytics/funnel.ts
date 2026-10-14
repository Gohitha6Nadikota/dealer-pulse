/**
 * Stage funnel for a cohort of leads. Reach comes from history only.
 * Caveat: recent leads haven't had time to progress, so conversion for a
 * cohort created in the last few weeks is biased low (right-censoring).
 */
import { STAGES, type Stage } from "@/lib/analytics/definitions";
import { ratio } from "@/lib/analytics/kpis";
import { timestampInRange, type MonthRange } from "@/lib/analytics/range";
import type { Lead } from "@/lib/types";

export type FunnelStage = {
  stage: Stage;
  /** Leads with a history entry for this stage. */
  reached: number;
  /** reached ÷ reached at the previous stage. null for the first stage or a zero base. */
  conversion: number | null;
  /** Leads whose last stage before being lost was this one. */
  lostHere: number;
};

export type LossReason = { reason: string; count: number; share: number };

export type Funnel = {
  total: number;
  stages: FunnelStage[];
  lost: number;
  /** From the structured lost_reason field, most frequent first. */
  lossReasons: LossReason[];
};

/** Leads created within the range: the usual funnel cohort. */
export function createdIn(leads: Lead[], range: MonthRange): Lead[] {
  return leads.filter((l) => timestampInRange(l.createdAt, range));
}

/** The stage a lost lead was in when it was lost. */
export function stageWhenLost(lead: Lead): Stage | null {
  if (!lead.lostAt) return null;
  const before = lead.history.filter((e) => e.status !== "lost");
  const last = before[before.length - 1];
  return last ? (last.status as Stage) : null;
}

export function funnel(leads: Lead[]): Funnel {
  const lostLeads = leads.filter((l) => l.lostAt !== null);

  const stages = STAGES.map((stage, i): FunnelStage => {
    const reached = leads.filter((l) => l.stageTimestamps[stage] !== undefined).length;
    const previous = i === 0 ? null : leads.filter((l) => l.stageTimestamps[STAGES[i - 1]] !== undefined).length;
    return {
      stage,
      reached,
      conversion: previous === null ? null : ratio(reached, previous),
      lostHere: lostLeads.filter((l) => stageWhenLost(l) === stage).length,
    };
  });

  const counts = new Map<string, number>();
  for (const lead of lostLeads) {
    const reason = lead.lostReason ?? "Not recorded";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  const lossReasons = [...counts]
    .map(([reason, count]) => ({ reason, count, share: count / lostLeads.length }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

  return { total: leads.length, stages, lost: lostLeads.length, lossReasons };
}

/**
 * The pre-order step with the lowest conversion: where most leads leak.
 * Delivery is excluded (an operations step, and censored for recent orders).
 * null when no step has a measurable conversion.
 */
export function biggestDrop(f: Funnel): { from: Stage; to: Stage; conversion: number } | null {
  let worst: { from: Stage; to: Stage; conversion: number } | null = null;
  for (let i = 1; i < f.stages.length; i++) {
    const step = f.stages[i];
    if (step.stage === "delivered" || step.conversion === null) continue;
    if (!worst || step.conversion < worst.conversion) {
      worst = { from: f.stages[i - 1].stage, to: step.stage, conversion: step.conversion };
    }
  }
  return worst;
}
