/**
 * One-line definitions shown in metric tooltips. Wording mirrors
 * lib/analytics/definitions.ts and the health rules; keep them in sync.
 */
import { THRESHOLDS } from "@/lib/analytics/definitions";
import { HEALTH_BASIS, HEALTH_RULES } from "@/lib/analytics/health";

export const METRIC_HELP = {
  bookedRevenue:
    "Sum of deal value for leads that reached Order placed in the selected months, by the month of the order.",
  bookedUnits:
    "Leads that reached Order placed in the selected months. Counted at order, not delivery, because delivery lags 1–5 weeks.",
  winRate:
    "Bookings ÷ (bookings + losses) in the selected months, each counted in the month it happened. Counts deals won/lost during the period. The funnel counts leads created in the period, so the two can differ.",
  avgDaysToDeliver:
    "Mean days from order to delivery for orders placed in the selected months. Recent months are biased low: slow deliveries haven't happened yet.",
  openPipeline:
    "Leads currently in New, Contacted, Test drive or Negotiation, with their deal value. A snapshot, not affected by the date filter.",
  awaitingDelivery:
    "Orders placed but not yet delivered. A snapshot, not affected by the date filter.",
  attainment:
    "Booked ÷ target for the selected months. Targets run several times above actual volume across all branches (see Data notes), so the trend matters more than the absolute figure.",
  funnel:
    "Leads created in the selected months and the furthest stage each reached, from status history. Recent leads are still in progress, so later stages look smaller.",
  health: `${HEALTH_BASIS} See Data notes. Act now: win rate under ${HEALTH_RULES.winRateAct * 100}% of the company's, or bookings down more than ${Math.abs(HEALTH_RULES.bookingsDropAct) * 100}% on the previous period. Watch: under ${HEALTH_RULES.winRateWatch * 100}%, down more than ${Math.abs(HEALTH_RULES.bookingsDropWatch) * 100}%, or delivery over ${HEALTH_RULES.deliveryWatch * 100}% of the company average. Needs ${HEALTH_RULES.minOutcomes}+ outcomes to judge win rate.`,
  staleLeads: `Open leads with no activity for ${THRESHOLDS.staleLeadDays}+ days, ranked by deal value × days idle.`,
  stuckOrders: `Orders placed ${THRESHOLDS.stuckOrderDays}–${THRESHOLDS.staleOrderDays} days ago and not yet delivered. Owned by the branch manager. Older orders are listed as likely stale records instead.`,
  staleOrders: `Orders still undelivered ${THRESHOLDS.staleOrderDays}+ days after they were placed. The slowest delivery on record took far less, so these are more likely stale CRM records (cancelled, or delivered but not logged) than delays. Not counted as revenue at risk.`,
  stalledNegotiations: `Leads in Negotiation for ${THRESHOLDS.stalledNegotiationDays}+ days.`,
} as const;
