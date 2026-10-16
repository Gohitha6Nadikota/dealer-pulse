/**
 * Action lists: things a manager should do today. All are snapshots as of
 * AS_OF and ignore the month filter. Thresholds live in definitions.ts.
 */
import { THRESHOLDS, isOpenStage } from "@/lib/analytics/definitions";
import { mean } from "@/lib/analytics/kpis";
import type { Lead } from "@/lib/types";

export type StaleLead = {
  lead: Lead;
  daysIdle: number;
  /** INR. The deal value that could slip. */
  valueAtRisk: number;
  /** valueAtRisk × daysIdle: bigger and older first. */
  priority: number;
};

/** Open leads idle for at least `thresholdDays`, highest priority first. */
export function staleLeads(
  leads: Lead[],
  thresholdDays: number = THRESHOLDS.staleLeadDays,
): StaleLead[] {
  return leads
    .filter((l) => isOpenStage(l.status) && l.daysIdle >= thresholdDays)
    .map((lead) => ({
      lead,
      daysIdle: lead.daysIdle,
      valueAtRisk: lead.dealValue,
      priority: lead.dealValue * lead.daysIdle,
    }))
    .sort((a, b) => b.priority - a.priority || a.lead.id.localeCompare(b.lead.id));
}

export type StuckOrder = { lead: Lead; daysWaiting: number };

/**
 * Genuine delivery delays: orders placed more than `thresholdDays` ago and not
 * delivered, but younger than `staleAfterDays`. Longest first. The dataset only
 * has delay_reason for delivered orders, so these carry no reason; see `delayReasons`.
 */
export function stuckOrders(
  leads: Lead[],
  thresholdDays: number = THRESHOLDS.stuckOrderDays,
  staleAfterDays: number = THRESHOLDS.staleOrderDays,
): StuckOrder[] {
  return leads
    .filter((l) => l.status === "order_placed" && l.daysInStage > thresholdDays && l.daysInStage < staleAfterDays)
    .map((lead) => ({ lead, daysWaiting: lead.daysInStage }))
    .sort((a, b) => b.daysWaiting - a.daysWaiting || a.lead.id.localeCompare(b.lead.id));
}

/**
 * Likely stale records: orders undelivered for `staleAfterDays` or more, far
 * beyond any delivery time in the data. They need the CRM status verified,
 * and are kept out of delay counts and revenue at risk. Longest first.
 */
export function staleOrderRecords(
  leads: Lead[],
  staleAfterDays: number = THRESHOLDS.staleOrderDays,
): StuckOrder[] {
  return leads
    .filter((l) => l.status === "order_placed" && l.daysInStage >= staleAfterDays)
    .map((lead) => ({ lead, daysWaiting: lead.daysInStage }))
    .sort((a, b) => b.daysWaiting - a.daysWaiting || a.lead.id.localeCompare(b.lead.id));
}

export type StalledNegotiation = { lead: Lead; daysInStage: number };

/** Leads sitting in negotiation for at least `thresholdDays`, highest value first. */
export function stalledNegotiations(
  leads: Lead[],
  thresholdDays: number = THRESHOLDS.stalledNegotiationDays,
): StalledNegotiation[] {
  return leads
    .filter((l) => l.status === "negotiation" && l.daysInStage >= thresholdDays)
    .map((lead) => ({ lead, daysInStage: lead.daysInStage }))
    .sort(
      (a, b) =>
        b.lead.dealValue - a.lead.dealValue ||
        b.daysInStage - a.daysInStage ||
        a.lead.id.localeCompare(b.lead.id),
    );
}

export type DelayReason = {
  reason: string;
  count: number;
  /** Mean days_to_deliver for deliveries with this reason. */
  avgDays: number;
};

export type DelaySummary = {
  delivered: number;
  delayed: number;
  /** Mean days for deliveries with and without a recorded reason. null if none. */
  avgDaysWithReason: number | null;
  avgDaysWithoutReason: number | null;
  reasons: DelayReason[];
};

/** Frequency of delay_reason across delivered leads, most frequent first. */
export function delayReasons(leads: Lead[]): DelaySummary {
  const delivered = leads.flatMap((l) => (l.delivery ? [l.delivery] : []));
  const delayed = delivered.filter((d) => d.delay_reason !== null);
  const byReason = new Map<string, number[]>();
  for (const d of delayed) {
    const days = byReason.get(d.delay_reason!) ?? [];
    days.push(d.days_to_deliver);
    byReason.set(d.delay_reason!, days);
  }
  return {
    delivered: delivered.length,
    delayed: delayed.length,
    avgDaysWithReason: mean(delayed.map((d) => d.days_to_deliver)),
    avgDaysWithoutReason: mean(
      delivered.filter((d) => d.delay_reason === null).map((d) => d.days_to_deliver),
    ),
    reasons: [...byReason]
      .map(([reason, days]) => ({ reason, count: days.length, avgDays: mean(days) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
  };
}
