/**
 * Funnel leak analysis. For each stage, every lead that reached it is
 * accounted for exactly once:
 *
 *   reached = moved on + lost here + still here
 *
 * "Lost here" counts only genuine loss events in history. Leads stored as
 * "lost" without a loss event are inconsistent CRM records, not losses: they
 * stay in "still here" and are counted separately as a data issue.
 *
 * A leak is a stage where a scope loses a larger share of leads than the
 * benchmark (the company, same cohort). Judged only with enough leads, and
 * only when the gap is unlikely to be chance (z-score vs the benchmark rate).
 */
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/analytics/definitions";
import { stageWhenLost } from "@/lib/analytics/funnel";
import { ratio } from "@/lib/analytics/kpis";
import { formatNumber, formatPercent } from "@/lib/format";
import type { Lead } from "@/lib/types";

/** Fewer leads than this reaching a stage: shown, but not judged. */
export const MIN_LEAK_SAMPLE = 20;
/** |z| at or above this marks a gap as unlikely to be chance (~95%, two-sided). */
export const LEAK_Z = 2;

/** Stages where a lead can be lost before ordering. */
export const LEAK_STAGES = ["new", "contacted", "test_drive", "negotiation"] as const satisfies readonly Stage[];
export type LeakStage = (typeof LEAK_STAGES)[number];

export type StageBreakdown = {
  stage: Stage;
  reached: number;
  /** Reached the next stage. */
  movedOn: number;
  /** Genuine loss events at this stage. */
  lostHere: number;
  /** Currently at this stage (open, or awaiting delivery for order_placed). */
  stillHere: number;
  /** Of stillHere: stored as lost with no loss event. */
  dataIssue: number;
  /** lostHere ÷ reached. */
  lossRate: number | null;
};

export type FunnelReconciliation = {
  total: number;
  stages: StageBreakdown[];
  outcome: { delivered: number; awaiting: number; open: number; openDataIssue: number; lost: number };
};

function reached(lead: Lead, stage: Stage): boolean {
  return lead.stageTimestamps[stage] !== undefined;
}

export function reconcileFunnel(leads: Lead[]): FunnelReconciliation {
  const stages = STAGES.map((stage, i): StageBreakdown => {
    const here = leads.filter((l) => reached(l, stage));
    const next = STAGES[i + 1];
    const stillHereLeads = here.filter((l) => l.status === stage);
    const lostHere = here.filter((l) => stageWhenLost(l) === stage).length;
    return {
      stage,
      reached: here.length,
      movedOn: next ? here.filter((l) => reached(l, next)).length : 0,
      lostHere,
      stillHere: stillHereLeads.length,
      dataIssue: stillHereLeads.filter((l) => l.dataQualityIssue !== null).length,
      lossRate: ratio(lostHere, here.length),
    };
  });
  const open = leads.filter((l) => (LEAK_STAGES as readonly string[]).includes(l.status));
  return {
    total: leads.length,
    stages,
    outcome: {
      delivered: leads.filter((l) => l.status === "delivered").length,
      awaiting: leads.filter((l) => l.status === "order_placed").length,
      open: open.length,
      openDataIssue: open.filter((l) => l.dataQualityIssue !== null).length,
      lost: leads.filter((l) => l.status === "lost").length,
    },
  };
}

export type LeakVerdict = "leak" | "better" | "normal" | "small_sample" | "no_data";

export type LeakCell = {
  stage: LeakStage;
  reached: number;
  lost: number;
  rate: number | null;
  benchmarkRate: number | null;
  /** Losses beyond what the benchmark rate predicts for this many leads (can be negative). */
  excessLosses: number;
  /** (rate − benchmark) ÷ standard error under the benchmark rate. */
  z: number | null;
  verdict: LeakVerdict;
};

/** Loss rate at each pre-order stage vs a benchmark breakdown. */
export function leakCells(subject: FunnelReconciliation, benchmark: FunnelReconciliation): LeakCell[] {
  return LEAK_STAGES.map((stage) => {
    const s = subject.stages.find((x) => x.stage === stage)!;
    const b = benchmark.stages.find((x) => x.stage === stage)!;
    const p0 = b.lossRate;
    const excess = p0 === null ? 0 : s.lostHere - s.reached * p0;
    const z =
      p0 === null || s.reached === 0 || p0 === 0 || p0 === 1
        ? null
        : (s.lostHere / s.reached - p0) / Math.sqrt((p0 * (1 - p0)) / s.reached);
    const verdict: LeakVerdict =
      s.reached === 0
        ? "no_data"
        : s.reached < MIN_LEAK_SAMPLE
          ? "small_sample"
          : z !== null && z >= LEAK_Z
            ? "leak"
            : z !== null && z <= -LEAK_Z
              ? "better"
              : "normal";
    return { stage, reached: s.reached, lost: s.lostHere, rate: s.lossRate, benchmarkRate: p0, excessLosses: excess, z, verdict };
  });
}

export type LeakRow = {
  id: string;
  name: string;
  kind: "branch" | "rep";
  /** Where the row links to. */
  href: string;
  cells: LeakCell[];
};

export type RankedLeak = { row: Omit<LeakRow, "cells">; cell: LeakCell };

/** Meaningful leaks only, largest excess losses first. */
export function largestLeaks(rows: LeakRow[], limit = 5): RankedLeak[] {
  return rows
    .flatMap((row) => {
      const { cells, ...rest } = row;
      return cells.filter((c) => c.verdict === "leak").map((cell) => ({ row: rest, cell }));
    })
    .sort((a, b) => b.cell.excessLosses - a.cell.excessLosses || a.row.name.localeCompare(b.row.name))
    .slice(0, limit);
}

export type LossReasonByStage = { reason: string; total: number; byStage: Record<LeakStage, number> };

/** Structured loss reasons split by the stage the lead was lost at. */
export function lossReasonsByStage(leads: Lead[]): LossReasonByStage[] {
  const map = new Map<string, LossReasonByStage>();
  for (const lead of leads) {
    const stage = stageWhenLost(lead);
    if (!stage || !(LEAK_STAGES as readonly string[]).includes(stage)) continue;
    const reason = lead.lostReason ?? "Not recorded";
    const row =
      map.get(reason) ??
      { reason, total: 0, byStage: { new: 0, contacted: 0, test_drive: 0, negotiation: 0 } };
    row.total += 1;
    row.byStage[stage as LeakStage] += 1;
    map.set(reason, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.reason.localeCompare(b.reason));
}

/** "Lakeside Toyota loses 39% of leads at New (31 of 79) vs 22% company-wide: about 14 more than expected." */
export function leakSentence({ row, cell }: RankedLeak): string {
  const excess = Math.round(cell.excessLosses);
  return `${row.name} loses ${formatPercent(cell.rate)} of leads at ${STAGE_LABELS[cell.stage]} (${formatNumber(cell.lost)} of ${formatNumber(cell.reached)}) vs ${formatPercent(cell.benchmarkRate)} company-wide: about ${formatNumber(excess)} more than expected.`;
}
