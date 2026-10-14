/**
 * Rule-based headline for the Overview: what changed, where it's coming from,
 * and what needs doing. Deterministic text from computed numbers, no LLM.
 */
import { THRESHOLDS } from "@/lib/analytics/definitions";
import type { Health } from "@/lib/analytics/health";
import { ratio, type Kpis } from "@/lib/analytics/kpis";
import type { MonthRange } from "@/lib/analytics/range";
import {
  formatChange,
  formatDays,
  formatINR,
  formatNumber,
  formatPercent,
  formatRange,
} from "@/lib/format";

export type Insight = {
  /** One sentence, readable in five seconds. */
  headline: string;
  /** Up to three supporting facts. */
  supporting: string[];
  tone: "positive" | "neutral" | "negative";
};

export type InsightInput = {
  /** "the company" or a branch name. */
  scopeName: string;
  range: MonthRange;
  current: Kpis;
  previous: Kpis | null;
  previousRange: MonthRange | null;
  /** Company scope: every branch with health. Branch scope: empty. */
  branches: { name: string; kpis: Kpis; health: Health }[];
  /** Branch scope: the company KPIs to compare against. */
  company: Kpis | null;
  stuckOrders: number;
  staleLeads: number;
  staleValue: number;
};

/** Below this many prior bookings, changes are stated as counts, not percentages. */
export const MIN_BASE_FOR_PERCENT = 10;

function plural(n: number, word: string): string {
  return `${formatNumber(n)} ${word}${n === 1 ? "" : "s"}`;
}

function bookingsClause(input: InsightInput): { text: string; change: number | null } {
  const { current, previous, previousRange, range } = input;
  const change = previous ? ratio(current.bookedUnits - previous.bookedUnits, previous.bookedUnits) : null;
  // Percentages on single-digit bases mislead ("up 25%" = 5 vs 4); state counts instead.
  if (previous && previousRange && previous.bookedUnits < MIN_BASE_FOR_PERCENT) {
    return {
      text: `${plural(current.bookedUnits, "car")} booked in ${formatRange(range)}, vs ${formatNumber(previous.bookedUnits)} in ${formatRange(previousRange)}`,
      change: null,
    };
  }
  if (previous && previousRange && change !== null) {
    const direction = change > 0.02 ? "up" : change < -0.02 ? "down" : "flat";
    const amount = direction === "flat" ? "" : ` ${formatChange(Math.abs(change)).replace("+", "")}`;
    return {
      text: `Bookings are ${direction}${amount} on ${formatRange(previousRange)} (${formatNumber(current.bookedUnits)} vs ${formatNumber(previous.bookedUnits)} cars)`,
      change,
    };
  }
  return {
    text: `${plural(current.bookedUnits, "car")} booked in ${formatRange(range)}, worth ${formatINR(current.bookedRevenue)}`,
    change: null,
  };
}

function laggardClause(input: InsightInput): string | null {
  if (input.company) {
    const { current, company } = input;
    if (current.winRate === null || company.winRate === null) return null;
    const gap = current.winRate - company.winRate;
    if (Math.abs(gap) < 0.03) return `win rate is in line with the company at ${formatPercent(current.winRate)}`;
    return `win rate is ${formatPercent(current.winRate)} vs ${formatPercent(company.winRate)} company-wide`;
  }
  const worst = input.branches
    .filter((b) => b.health.level === "act")
    .sort((a, b) => (a.kpis.winRate ?? 1) - (b.kpis.winRate ?? 1))[0];
  if (!worst) return null;
  return `${worst.name} needs attention (${worst.health.reasons[0].toLowerCase()})`;
}

export function overviewInsight(input: InsightInput): Insight {
  const bookings = bookingsClause(input);
  const laggard = laggardClause(input);
  const headline = laggard ? `${bookings.text}; ${laggard}.` : `${bookings.text}.`;

  const supporting: string[] = [];
  if (input.stuckOrders > 0) {
    supporting.push(
      `${plural(input.stuckOrders, "order")} waiting more than ${THRESHOLDS.stuckOrderDays} days for delivery.`,
    );
  }
  const { current, previous } = input;
  if (current.avgDaysToDeliver !== null && previous?.avgDaysToDeliver) {
    const change = ratio(current.avgDaysToDeliver - previous.avgDaysToDeliver, previous.avgDaysToDeliver);
    if (change !== null && Math.abs(change) >= 0.1) {
      supporting.push(
        `Delivery time ${change > 0 ? "rose" : "fell"} from ${formatDays(previous.avgDaysToDeliver)} to ${formatDays(current.avgDaysToDeliver)}.`,
      );
    }
  }
  if (input.staleLeads > 0) {
    supporting.push(
      `${plural(input.staleLeads, "open lead")} idle ${THRESHOLDS.staleLeadDays}+ days, ${formatINR(input.staleValue)} in play.`,
    );
  }

  const change = bookings.change;
  const tone =
    change !== null && change < -0.1
      ? "negative"
      : change !== null && change > 0.1 && !laggard
        ? "positive"
        : "neutral";

  return { headline, supporting: supporting.slice(0, 3), tone };
}
