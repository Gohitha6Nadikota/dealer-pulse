/**
 * Y-axis scale for the monthly bookings chart. Targets run ~7× actual volume,
 * so drawing them on the same axis flattens the bars. The axis is capped near
 * 1.5× the largest booked value; a target above the cap is not drawn but
 * labelled "off-scale" with its values.
 */
import type { TrendPoint } from "@/lib/analytics/trend";

export type TrendMetric = "attainment" | "units" | "revenue";

/** Headroom above the largest booked value. */
export const TREND_HEADROOM = 1.5;

export type TrendScale = {
  /** Upper bound of the y-axis. */
  max: number;
  /** Evenly spaced round ticks from 0 to `max`. */
  ticks: number[];
  /**
   * Target for this metric: drawn when it fits under `max`, otherwise
   * labelled off-scale with its range. null when the scope has no target.
   */
  target: { offScale: boolean; min: number; max: number } | null;
};

/** Round numbers the axis may end on, per power of ten. Fine-grained so the cap stays near 1.5× the peak. */
const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];

/** Smallest round number (see NICE_STEPS) × 10^k that is ≥ value. 0 for 0. */
export function niceCeil(value: number): number {
  if (!(value > 0)) return 0;
  const exp = 10 ** Math.floor(Math.log10(value));
  // toPrecision removes float noise such as 3 × 0.1 = 0.30000000000000004.
  const exact = (n: number) => Number(n.toPrecision(12));
  for (const step of NICE_STEPS) {
    if (step * exp >= value - 1e-9) return exact(step * exp);
  }
  return exact(10 * exp);
}

/** Is `step` 1, 2, 2.5 or 5 × 10^k? */
function isRoundStep(step: number): boolean {
  const exp = 10 ** Math.floor(Math.log10(step));
  const mantissa = Number((step / exp).toPrecision(12));
  return [1, 2, 2.5, 5, 10].includes(mantissa);
}

/** 3–6 evenly spaced ticks from 0 to max on a round step; just [0, max] if none fits. */
export function axisTicks(max: number): number[] {
  if (!(max > 0)) return [0];
  for (const n of [4, 5, 3, 6]) {
    const step = max / n;
    if (isRoundStep(step)) return Array.from({ length: n + 1 }, (_, i) => Number((i * step).toPrecision(12)));
  }
  return [0, max];
}

function values(points: TrendPoint[], metric: TrendMetric): { booked: number[]; target: number[] } {
  switch (metric) {
    case "attainment":
      return {
        booked: points.flatMap((p) => (p.unitAttainment === null ? [] : [p.unitAttainment])),
        // Attainment's target is always 100%, wherever a target exists.
        target: points.flatMap((p) => (p.unitAttainment === null ? [] : [1])),
      };
    case "units":
      return {
        booked: points.map((p) => p.bookedUnits),
        target: points.flatMap((p) => (p.targetUnits ? [p.targetUnits] : [])),
      };
    case "revenue":
      return {
        booked: points.map((p) => p.bookedRevenue),
        target: points.flatMap((p) => (p.targetRevenue ? [p.targetRevenue] : [])),
      };
  }
}

export function trendScale(points: TrendPoint[], metric: TrendMetric): TrendScale {
  const { booked, target } = values(points, metric);
  const peak = booked.length ? Math.max(...booked) : 0;
  const fallback = metric === "attainment" ? 0.1 : 1;
  const max = niceCeil(peak * TREND_HEADROOM) || fallback;
  const ticks = axisTicks(max);
  if (!target.length) return { max, ticks, target: null };
  const tMin = Math.min(...target);
  const tMax = Math.max(...target);
  return { max, ticks, target: { offScale: tMax > max, min: tMin, max: tMax } };
}

/** The chart opens on attainment when the scope has targets, otherwise on units. */
export function defaultTrendMetric(points: TrendPoint[]): TrendMetric {
  return points.some((p) => p.unitAttainment !== null) ? "attainment" : "units";
}
