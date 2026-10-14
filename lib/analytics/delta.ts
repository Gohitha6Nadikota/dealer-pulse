/** Period-over-period change, with whether the move is good or bad for the business. */
import { formatChange } from "@/lib/format";

export type Delta = {
  /** "+12%", "−3 pts". */
  label: string;
  direction: "up" | "down" | "flat";
  sentiment: "good" | "bad" | "neutral";
};

function build(change: number, label: string, flat: number, higherIsBetter: boolean): Delta {
  if (Math.abs(change) < flat) return { label, direction: "flat", sentiment: "neutral" };
  const direction = change > 0 ? "up" : "down";
  const good = direction === "up" ? higherIsBetter : !higherIsBetter;
  return { label, direction, sentiment: good ? "good" : "bad" };
}

/** Relative change. null when there is nothing to compare with. */
export function relativeDelta(
  current: number | null,
  previous: number | null,
  { higherIsBetter = true }: { higherIsBetter?: boolean } = {},
): Delta | null {
  if (current === null || previous === null || previous === 0) return null;
  const change = (current - previous) / previous;
  return build(change, formatChange(change), 0.01, higherIsBetter);
}

/** Change between two ratios in percentage points: 0.42 → 0.47 is "+5 pts". */
export function pointsDelta(
  current: number | null,
  previous: number | null,
  { higherIsBetter = true }: { higherIsBetter?: boolean } = {},
): Delta | null {
  if (current === null || previous === null) return null;
  const points = Math.round((current - previous) * 100);
  const label = points === 0 ? "0 pts" : `${points > 0 ? "+" : "−"}${Math.abs(points)} pts`;
  return build(points, label, 1, higherIsBetter);
}
