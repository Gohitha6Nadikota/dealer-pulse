/** Month-by-month bookings vs target, with delivery speed per order cohort. */
import { bookingMonth, mean, ratio, sumBy } from "@/lib/analytics/kpis";
import { monthOf, monthsInRange, type MonthRange } from "@/lib/analytics/range";
import type { Lead, Target } from "@/lib/types";

export type TrendPoint = {
  month: string;
  bookedUnits: number;
  /** INR. */
  bookedRevenue: number;
  /** null when the scope has no targets. */
  targetUnits: number | null;
  targetRevenue: number | null;
  unitAttainment: number | null;
  revenueAttainment: number | null;
  /** Change in booked units vs the previous month as a ratio; null for the first month or a zero base. */
  bookedUnitsChange: number | null;
  /** Leads delivered during this month. */
  deliveredUnits: number;
  /** Mean days_to_deliver for orders placed this month that have been delivered. */
  avgDaysToDeliver: number | null;
  /**
   * Share of this month's orders already delivered. Below 1 means the
   * delivery average is right-censored: slow deliveries haven't happened yet.
   */
  deliveryCompleteness: number | null;
};

export function monthlyTrend(
  leads: Lead[],
  targets: Target[] | null,
  range: MonthRange,
): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const month of monthsInRange(range)) {
    const booked = leads.filter((l) => bookingMonth(l) === month);
    const delivered = booked.filter((l) => l.delivery !== null);
    const monthTargets = targets?.filter((t) => t.month === month) ?? null;
    const targetUnits = monthTargets ? sumBy(monthTargets, (t) => t.target_units) : null;
    const targetRevenue = monthTargets ? sumBy(monthTargets, (t) => t.target_revenue) : null;
    const bookedRevenue = sumBy(booked, (l) => l.dealValue);
    const previous = points[points.length - 1];

    points.push({
      month,
      bookedUnits: booked.length,
      bookedRevenue,
      targetUnits,
      targetRevenue,
      unitAttainment: targetUnits === null ? null : ratio(booked.length, targetUnits),
      revenueAttainment: targetRevenue === null ? null : ratio(bookedRevenue, targetRevenue),
      bookedUnitsChange: previous
        ? ratio(booked.length - previous.bookedUnits, previous.bookedUnits)
        : null,
      deliveredUnits: leads.filter((l) => l.deliveredAt && monthOf(l.deliveredAt) === month).length,
      avgDaysToDeliver: mean(delivered.map((l) => l.delivery!.days_to_deliver)),
      deliveryCompleteness: ratio(delivered.length, booked.length),
    });
  }
  return points;
}
