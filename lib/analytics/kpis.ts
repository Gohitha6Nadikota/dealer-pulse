/**
 * Headline KPIs for any scope (company, branch, rep). Callers pass leads and
 * targets already narrowed to the scope; a rep has no targets, so pass null.
 */
import { isOpenStage } from "@/lib/analytics/definitions";
import { inRange, timestampInRange, monthOf, type MonthRange } from "@/lib/analytics/range";
import type { Lead, Target } from "@/lib/types";

export type Kpis = {
  /** Leads whose order_placed entry falls in the range. */
  bookedUnits: number;
  /** Sum of deal_value of booked units, INR. */
  bookedRevenue: number;
  /** null when the scope has no targets (e.g. a rep). */
  targetUnits: number | null;
  targetRevenue: number | null;
  /** booked ÷ target, as a ratio (0.15 = 15%). null when no target. */
  unitAttainment: number | null;
  revenueAttainment: number | null;
  /** Outcomes in the range: bookings and losses, each by the month it happened. */
  wins: number;
  losses: number;
  /** wins ÷ (wins + losses). null when there were no outcomes. */
  winRate: number | null;
  /** Orders placed in the range that have been delivered. */
  deliveredUnits: number;
  /** Mean days_to_deliver for orders placed in the range. null if none delivered. */
  avgDaysToDeliver: number | null;
  // Snapshot as of AS_OF; independent of the range.
  openPipelineCount: number;
  /** INR. */
  openPipelineValue: number;
  awaitingDeliveryCount: number;
  /** INR. */
  awaitingDeliveryValue: number;
};

export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function sumBy<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}

/** Leads booked (order_placed entry) within the range. */
export function bookedIn(leads: Lead[], range: MonthRange): Lead[] {
  return leads.filter((l) => timestampInRange(l.bookedAt, range));
}

export function kpis(leads: Lead[], targets: Target[] | null, range: MonthRange): Kpis {
  const booked = bookedIn(leads, range);
  const losses = leads.filter((l) => timestampInRange(l.lostAt, range)).length;
  const bookedRevenue = sumBy(booked, (l) => l.dealValue);

  const scopedTargets = targets?.filter((t) => inRange(t.month, range)) ?? null;
  const targetUnits = scopedTargets ? sumBy(scopedTargets, (t) => t.target_units) : null;
  const targetRevenue = scopedTargets ? sumBy(scopedTargets, (t) => t.target_revenue) : null;

  const delivered = booked.filter((l) => l.delivery !== null);
  const open = leads.filter((l) => isOpenStage(l.status));
  const awaiting = leads.filter((l) => l.status === "order_placed");

  return {
    bookedUnits: booked.length,
    bookedRevenue,
    targetUnits,
    targetRevenue,
    unitAttainment: targetUnits === null ? null : ratio(booked.length, targetUnits),
    revenueAttainment: targetRevenue === null ? null : ratio(bookedRevenue, targetRevenue),
    wins: booked.length,
    losses,
    winRate: ratio(booked.length, booked.length + losses),
    deliveredUnits: delivered.length,
    avgDaysToDeliver: mean(delivered.map((l) => l.delivery!.days_to_deliver)),
    openPipelineCount: open.length,
    openPipelineValue: sumBy(open, (l) => l.dealValue),
    awaitingDeliveryCount: awaiting.length,
    awaitingDeliveryValue: sumBy(awaiting, (l) => l.dealValue),
  };
}

/** Booking month of a lead, or null if never booked. */
export function bookingMonth(lead: Lead): string | null {
  return lead.bookedAt ? monthOf(lead.bookedAt) : null;
}
