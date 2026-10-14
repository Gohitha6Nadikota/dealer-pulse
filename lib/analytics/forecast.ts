/**
 * Pipeline outlook: how much of today's open pipeline is likely to turn into
 * orders, eventually. Not a dated sales forecast.
 *
 * Method
 *  1. History window: the creation months in which every lead has already
 *     resolved (ordered or lost). Using only resolved cohorts avoids
 *     right-censoring: recent leads haven't had time to be lost or ordered.
 *  2. For each open stage s: p(s) = leads in the window that reached s and
 *     later ordered ÷ leads in the window that reached s.
 *  3. Each open lead at stage s contributes p(s) × deal value.
 *  4. Range: treating leads as independent yes/no outcomes, the total is
 *     approximately normal with variance Σ v²·p·(1−p); we show mean ± 1.645 σ
 *     (~90%), clamped to [0, pipeline value]. This covers outcome luck only,
 *     not changes in conversion behaviour, so it understates true uncertainty.
 */
import { OPEN_STAGES, type OpenStage } from "@/lib/analytics/definitions";
import { monthOf } from "@/lib/analytics/range";
import { ratio, sumBy } from "@/lib/analytics/kpis";
import type { Lead } from "@/lib/types";

/** Need at least this many historical leads at a stage to use a scope's own rate for it. */
export const FORECAST_MIN_STAGE_SAMPLE = 20;
const Z90 = 1.645;

export type StageProbability = {
  stage: OpenStage;
  /** Whose history the rate comes from. */
  source: "own" | "company";
  /** Historical leads that reached the stage. */
  reached: number;
  /** Of those, how many went on to order. */
  ordered: number;
  p: number | null;
  /** Median days from reaching this stage to the order, for those that ordered. */
  medianDaysToOrder: number | null;
};

const resolved = (l: Lead) => l.bookedAt !== null || l.lostAt !== null;

/**
 * Creation months, from the first, in which every lead has resolved. Stops at
 * the first month with an unresolved lead. null if even the first month isn't resolved.
 */
export function resolvedWindow(leads: Lead[]): { from: string; to: string } | null {
  const months = [...new Set(leads.map((l) => monthOf(l.createdAt)))].sort();
  let last: string | null = null;
  for (const month of months) {
    if (!leads.filter((l) => monthOf(l.createdAt) === month).every(resolved)) break;
    last = month;
  }
  return last ? { from: months[0], to: last } : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function stageProbabilities(history: Lead[], source: StageProbability["source"] = "own"): StageProbability[] {
  return OPEN_STAGES.map((stage) => {
    const reachedStage = history.filter((l) => l.stageTimestamps[stage] !== undefined);
    const ordered = reachedStage.filter((l) => l.bookedAt !== null);
    return {
      stage,
      source,
      reached: reachedStage.length,
      ordered: ordered.length,
      p: ratio(ordered.length, reachedStage.length),
      medianDaysToOrder: median(
        ordered.map((l) => (Date.parse(l.bookedAt!) - Date.parse(l.stageTimestamps[stage]!)) / 86_400_000),
      ),
    };
  });
}

export type ForecastStage = {
  stage: OpenStage;
  openLeads: number;
  /** INR. */
  pipelineValue: number;
  p: number | null;
  expectedOrders: number;
  /** INR. */
  expectedValue: number;
  medianDaysToOrder: number | null;
};

export type PipelineForecast = {
  stages: ForecastStage[];
  openLeads: number;
  pipelineValue: number;
  expectedOrders: number;
  expectedValue: number;
  /** ~90% range for orders and value, from outcome variation only. */
  ordersRange: [number, number];
  valueRange: [number, number];
};

/** Expected orders and value from open leads, given stage probabilities. */
export function forecastPipeline(open: Lead[], probabilities: StageProbability[]): PipelineForecast {
  const p = new Map(probabilities.map((s) => [s.stage, s]));
  const stages = OPEN_STAGES.map((stage): ForecastStage => {
    const leads = open.filter((l) => l.status === stage);
    const prob = p.get(stage)?.p ?? null;
    return {
      stage,
      openLeads: leads.length,
      pipelineValue: sumBy(leads, (l) => l.dealValue),
      p: prob,
      expectedOrders: prob === null ? 0 : leads.length * prob,
      expectedValue: prob === null ? 0 : sumBy(leads, (l) => l.dealValue) * prob,
      medianDaysToOrder: p.get(stage)?.medianDaysToOrder ?? null,
    };
  });
  let varOrders = 0;
  let varValue = 0;
  for (const lead of open) {
    const prob = p.get(lead.status as OpenStage)?.p ?? 0;
    varOrders += prob * (1 - prob);
    varValue += lead.dealValue ** 2 * prob * (1 - prob);
  }
  const expectedOrders = sumBy(stages, (s) => s.expectedOrders);
  const expectedValue = sumBy(stages, (s) => s.expectedValue);
  const pipelineValue = sumBy(stages, (s) => s.pipelineValue);
  const clamp = (x: number, max: number) => Math.min(max, Math.max(0, x));
  return {
    stages,
    openLeads: open.length,
    pipelineValue,
    expectedOrders,
    expectedValue,
    ordersRange: [
      clamp(Math.floor(expectedOrders - Z90 * Math.sqrt(varOrders)), open.length),
      clamp(Math.ceil(expectedOrders + Z90 * Math.sqrt(varOrders)), open.length),
    ],
    valueRange: [
      clamp(expectedValue - Z90 * Math.sqrt(varValue), pipelineValue),
      clamp(expectedValue + Z90 * Math.sqrt(varValue), pipelineValue),
    ],
  };
}

export type Forecast = {
  /** null when no creation month is fully resolved: no forecast is shown. */
  window: { from: string; to: string; leads: number } | null;
  /**
   * Rate used per stage: the scope's own when it has at least
   * FORECAST_MIN_STAGE_SAMPLE historical leads at that stage, else the company's.
   */
  probabilities: StageProbability[];
  /** The scope's own historical rates, shown for transparency even where not used. */
  ownProbabilities: StageProbability[];
  companyProbabilities: StageProbability[];
  pipeline: PipelineForecast | null;
  /** Same forecast without leads stored as lost (status conflicts). */
  withoutStatusConflicts: PipelineForecast | null;
  statusConflicts: number;
};

/** Outlook for a scope's open pipeline (pass the same list twice for the company). */
export function buildForecast(allLeads: Lead[], scopeLeads: Lead[]): Forecast {
  const window = resolvedWindow(allLeads);
  const inWindow = (l: Lead) =>
    window !== null && monthOf(l.createdAt) >= window.from && monthOf(l.createdAt) <= window.to;
  const companyProbabilities = stageProbabilities(allLeads.filter(inWindow), "company");
  const ownProbabilities = stageProbabilities(scopeLeads.filter(inWindow), "own");
  const probabilities = ownProbabilities.map((own, i) =>
    own.reached >= FORECAST_MIN_STAGE_SAMPLE ? own : companyProbabilities[i],
  );

  const open = scopeLeads.filter((l) => (OPEN_STAGES as readonly string[]).includes(l.status));
  const consistent = open.filter((l) => l.dataQualityIssue === null);
  return {
    window: window && { ...window, leads: allLeads.filter(inWindow).length },
    probabilities,
    ownProbabilities,
    companyProbabilities,
    pipeline: window ? forecastPipeline(open, probabilities) : null,
    withoutStatusConflicts: window ? forecastPipeline(consistent, probabilities) : null,
    statusConflicts: open.length - consistent.length,
  };
}
