/**
 * Branch health badge. Targets run ~6× actual volume (see the audit), so
 * health is judged against the company and against the branch's own recent
 * past, not against target attainment.
 *
 * Act now (red), if any:
 *   - win rate below 75% of the company win rate
 *   - booked units down more than 25% vs the previous period
 * Watch (amber), if any (and not red):
 *   - win rate below 90% of the company win rate
 *   - booked units down more than 10% vs the previous period
 *   - average delivery time over 125% of the company average
 * Healthy (green) otherwise.
 *
 * Win-rate rules need at least MIN_OUTCOMES bookings + losses in the period;
 * comparison rules are skipped when there is no previous period.
 */
import type { Kpis } from "@/lib/analytics/kpis";
import { ratio } from "@/lib/analytics/kpis";
import { formatChange, formatDays, formatPercent } from "@/lib/format";

export type HealthLevel = "healthy" | "watch" | "act";

export type Health = {
  level: HealthLevel;
  /** Plain-language reasons, worst first. Empty when healthy. */
  reasons: string[];
};

export const HEALTH_RULES = {
  winRateAct: 0.75,
  winRateWatch: 0.9,
  bookingsDropAct: -0.25,
  bookingsDropWatch: -0.1,
  deliveryWatch: 1.25,
  minOutcomes: 5,
} as const;

/** What health is (and isn't) based on, for tooltips. */
export const HEALTH_BASIS =
  "Health is based on win rate vs the company average, bookings vs the branch's own previous period, and delivery time vs the company average. It does not use target attainment: targets look unreachable relative to the data.";

export const HEALTH_LABELS: Record<HealthLevel, string> = {
  healthy: "Healthy",
  watch: "Watch",
  act: "Act now",
};

export function branchHealth(input: {
  current: Kpis;
  previous: Kpis | null;
  company: Kpis;
}): Health {
  const { current, previous, company } = input;
  const act: string[] = [];
  const watch: string[] = [];

  const outcomes = current.wins + current.losses;
  if (outcomes >= HEALTH_RULES.minOutcomes && current.winRate !== null && company.winRate) {
    const relative = current.winRate / company.winRate;
    const text = `Win rate ${formatPercent(current.winRate)} vs ${formatPercent(company.winRate)} company`;
    if (relative < HEALTH_RULES.winRateAct) act.push(text);
    else if (relative < HEALTH_RULES.winRateWatch) watch.push(text);
  }

  if (previous) {
    const change = ratio(current.bookedUnits - previous.bookedUnits, previous.bookedUnits);
    if (change !== null) {
      const text = `Bookings ${formatChange(change)} vs previous period`;
      if (change < HEALTH_RULES.bookingsDropAct) act.push(text);
      else if (change < HEALTH_RULES.bookingsDropWatch) watch.push(text);
    }
  }

  if (current.avgDaysToDeliver !== null && company.avgDaysToDeliver) {
    if (current.avgDaysToDeliver > company.avgDaysToDeliver * HEALTH_RULES.deliveryWatch) {
      watch.push(
        `Delivery ${formatDays(current.avgDaysToDeliver)} vs ${formatDays(company.avgDaysToDeliver)} company`,
      );
    }
  }

  if (act.length) return { level: "act", reasons: [...act, ...watch] };
  if (watch.length) return { level: "watch", reasons: watch };
  return { level: "healthy", reasons: [] };
}
