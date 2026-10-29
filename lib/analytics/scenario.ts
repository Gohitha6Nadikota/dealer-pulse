/**
 * What-if scenarios on the funnel. The user nudges each stage-to-next-stage
 * conversion (and lead volume) by a relative amount; we show the effect on the
 * lead-to-order rate, today's open pipeline, and the monthly run-rate.
 *
 * Why it is simple here: no lead in the data skips a stage, so the chance of
 * ordering from a stage is the product of the step rates after it:
 *
 *   p(New) = c(New→Contacted) × c(Contacted→Test drive) × c(Test drive→Negotiation) × c(Negotiation→Order)
 *
 * The baseline is the Pipeline outlook's own p(stage) (same history window,
 * same own/company rule). A slider scales one step rate c → min(100%, c × (1 + δ)),
 * which scales p for every stage before that step by the same factor. With all
 * sliders at 0 the result equals the outlook exactly.
 *
 * Pure and dependency-light: the panel runs it in the browser on every slider move.
 */
import { OPEN_STAGES, type OpenStage, type Stage } from "@/lib/analytics/definitions";
import {
  FORECAST_MIN_STAGE_SAMPLE,
  pipelineTotals,
  type Forecast,
  type PipelineItem,
  type PipelineTotals,
  type StageProbability,
} from "@/lib/analytics/forecast";
import { ratio, sumBy } from "@/lib/analytics/kpis";
import { monthOf } from "@/lib/analytics/range";
import type { Branch, Dataset, Lead } from "@/lib/types";

/** The four levers, in funnel order. */
export const SCENARIO_STEPS = [
  { from: "new", to: "contacted" },
  { from: "contacted", to: "test_drive" },
  { from: "test_drive", to: "negotiation" },
  { from: "negotiation", to: "order_placed" },
] as const satisfies readonly { from: OpenStage; to: Stage }[];

/** Slider bounds, as relative changes (−0.5 = halve, +1 = double, capped at 100%). */
export const STEP_ADJUSTMENT_RANGE = { min: -0.5, max: 1 } as const;
export const VOLUME_ADJUSTMENT_RANGE = { min: -0.5, max: 0.5 } as const;
/** Months of recent lead volume averaged for the run-rate. */
export const VOLUME_MONTHS = 3;

export type ScenarioStep = {
  from: OpenStage;
  to: Stage;
  /** Today's step conversion implied by the outlook's stage probabilities. */
  rate: number | null;
  /** Whose history it comes from; "mixed" when the two stages use different sources. */
  source: "own" | "company" | "mixed";
};

export type Adjustments = {
  /** Relative change per step, in SCENARIO_STEPS order. */
  steps: number[];
  /** Relative change in monthly lead volume. */
  volume: number;
};

export const NO_ADJUSTMENTS: Adjustments = { steps: SCENARIO_STEPS.map(() => 0), volume: 0 };

export type ScenarioPreset = {
  id: "match_company" | "match_best";
  label: string;
  description: string;
  adjustments: Adjustments;
};

/** Everything the panel needs, computed once on the server; serialisable. */
export type ScenarioInputs = {
  steps: ScenarioStep[];
  /** The outlook's chance of ordering per open stage. */
  baseProbabilities: Record<OpenStage, number | null>;
  /** Open leads, with whether each is a status conflict (stored as lost). */
  open: (PipelineItem & { conflict: boolean })[];
  /** Average leads created per month over the last VOLUME_MONTHS months, in scope. */
  monthlyVolume: number;
  volumeWindow: { from: string; to: string };
  /** Mean deal value of booked leads in scope, INR. null if none booked. */
  avgDealValue: number | null;
  presets: ScenarioPreset[];
};

export type ScenarioResult = {
  rates: (number | null)[];
  probabilities: Record<OpenStage, number | null>;
  /** Chance a new lead ends in an order. */
  leadToOrder: number | null;
  pipeline: PipelineTotals;
  /** Leads per month after the volume adjustment. */
  monthlyLeads: number;
  monthlyOrders: number | null;
  /** INR. */
  monthlyRevenue: number | null;
};

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Step rates implied by stage probabilities: c(k) = p(from k) ÷ p(from k+1); the last is p(Negotiation). */
export function stepRatesFromProbabilities(probabilities: StageProbability[]): ScenarioStep[] {
  const byStage = new Map(probabilities.map((p) => [p.stage, p]));
  return SCENARIO_STEPS.map((step, i) => {
    const here = byStage.get(step.from);
    const next = i < SCENARIO_STEPS.length - 1 ? byStage.get(SCENARIO_STEPS[i + 1].from) : null;
    const rate =
      here?.p == null
        ? null
        : next === null
          ? here.p
          : next?.p
            ? Math.min(1, here.p / next.p)
            : null;
    const source = next === null || next?.source === here?.source ? (here?.source ?? "company") : "mixed";
    return { from: step.from, to: step.to, rate, source };
  });
}

/** Today's rate × (1 + adjustment), kept within 0–100%. null stays null. */
export function adjustedRates(steps: ScenarioStep[], adjustments: Adjustments): (number | null)[] {
  return steps.map((s, i) => (s.rate === null ? null : clamp(s.rate * (1 + (adjustments.steps[i] ?? 0)), 0, 1)));
}

/**
 * Scenario chance of ordering per stage: the baseline p(stage) times the change
 * in every step from that stage onward. Equal to the baseline when nothing moves.
 */
export function scenarioProbabilities(
  steps: ScenarioStep[],
  base: Record<OpenStage, number | null>,
  adjustments: Adjustments,
): Record<OpenStage, number | null> {
  const rates = adjustedRates(steps, adjustments);
  const factor = steps.map((s, i) => (s.rate ? rates[i]! / s.rate : 1));
  return Object.fromEntries(
    OPEN_STAGES.map((stage) => {
      const start = SCENARIO_STEPS.findIndex((s) => s.from === stage);
      const p = base[stage];
      if (p === null) return [stage, null];
      const scaled = factor.slice(start).reduce((acc, f) => acc * f, p);
      return [stage, clamp(scaled, 0, 1)];
    }),
  ) as Record<OpenStage, number | null>;
}

/** Baseline or scenario figures for the panel. */
export function runScenario(
  inputs: ScenarioInputs,
  adjustments: Adjustments,
  { includeConflicts = true }: { includeConflicts?: boolean } = {},
): ScenarioResult {
  const probabilities = scenarioProbabilities(inputs.steps, inputs.baseProbabilities, adjustments);
  const items = inputs.open.filter((o) => includeConflicts || !o.conflict);
  const leadToOrder = probabilities.new;
  const monthlyLeads = inputs.monthlyVolume * (1 + clamp(adjustments.volume, VOLUME_ADJUSTMENT_RANGE.min, VOLUME_ADJUSTMENT_RANGE.max));
  const monthlyOrders = leadToOrder === null ? null : monthlyLeads * leadToOrder;
  return {
    rates: adjustedRates(inputs.steps, adjustments),
    probabilities,
    leadToOrder,
    pipeline: pipelineTotals(items, probabilities),
    monthlyLeads,
    monthlyOrders,
    monthlyRevenue: monthlyOrders === null || inputs.avgDealValue === null ? null : monthlyOrders * inputs.avgDealValue,
  };
}

/** Relative change that turns `from` into `to`, kept to the slider range. null if either is missing. */
export function adjustmentBetween(from: number | null, to: number | null): number | null {
  if (!from || to === null) return null;
  return clamp(to / from - 1, STEP_ADJUSTMENT_RANGE.min, STEP_ADJUSTMENT_RANGE.max);
}

function probabilityRecord(probabilities: StageProbability[]): Record<OpenStage, number | null> {
  return Object.fromEntries(OPEN_STAGES.map((s) => [s, probabilities.find((p) => p.stage === s)?.p ?? null])) as Record<
    OpenStage,
    number | null
  >;
}

/**
 * Server-side inputs for a scope. `forecast` is the scope's Pipeline outlook;
 * `branchForecasts` are every branch's, used for the "match best branch" preset.
 */
export function buildScenarioInputs(
  ds: Dataset,
  scopeLeads: Lead[],
  forecast: Forecast,
  scopeBranch: Branch | null,
  branchForecasts: { branch: Branch; forecast: Forecast }[],
): ScenarioInputs {
  const steps = stepRatesFromProbabilities(forecast.probabilities);
  const months = ds.months.slice(-VOLUME_MONTHS);
  const recent = scopeLeads.filter((l) => months.includes(monthOf(l.createdAt)));
  const booked = scopeLeads.filter((l) => l.bookedAt !== null);

  const presets: ScenarioPreset[] = [];
  if (scopeBranch) {
    const company = stepRatesFromProbabilities(forecast.companyProbabilities);
    presets.push({
      id: "match_company",
      label: "Match company rates",
      description: `Each step at the company's rate: what ${scopeBranch.name} gains by converting like the average branch.`,
      adjustments: { steps: steps.map((s, i) => Math.max(0, adjustmentBetween(s.rate, company[i].rate) ?? 0)), volume: 0 },
    });
  }
  // Best branch per step, using only rates a branch has enough history for.
  const best = SCENARIO_STEPS.map((_, i) => {
    const rates = branchForecasts
      .map((b) => stepRatesFromProbabilities(b.forecast.ownProbabilities)[i])
      .filter((s, j) => {
        const own = branchForecasts[j].forecast.ownProbabilities;
        const from = own.find((p) => p.stage === SCENARIO_STEPS[i].from);
        const next = i < SCENARIO_STEPS.length - 1 ? own.find((p) => p.stage === SCENARIO_STEPS[i + 1].from) : null;
        const enough = (n: number | undefined) => (n ?? 0) >= FORECAST_MIN_STAGE_SAMPLE;
        return s.rate !== null && enough(from?.reached) && (next === null || enough(next?.reached));
      })
      .map((s) => s.rate!);
    return rates.length ? Math.max(...rates) : null;
  });
  presets.push({
    id: "match_best",
    label: "Match best branch",
    description: `Each step at the best branch's rate for that step (branches with ${FORECAST_MIN_STAGE_SAMPLE}+ past leads at it). Combines different branches' best steps, so it is an optimistic upper bound.`,
    adjustments: { steps: steps.map((s, i) => Math.max(0, adjustmentBetween(s.rate, best[i]) ?? 0)), volume: 0 },
  });

  return {
    steps,
    baseProbabilities: probabilityRecord(forecast.probabilities),
    open: scopeLeads
      .filter((l) => (OPEN_STAGES as readonly string[]).includes(l.status))
      .map((l) => ({ stage: l.status as OpenStage, value: l.dealValue, conflict: l.dataQualityIssue !== null })),
    monthlyVolume: recent.length / months.length,
    volumeWindow: { from: months[0], to: months[months.length - 1] },
    avgDealValue: ratio(sumBy(booked, (l) => l.dealValue), booked.length),
    presets,
  };
}
