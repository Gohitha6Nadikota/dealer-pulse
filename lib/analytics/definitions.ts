/**
 * Domain definitions for DealerPulse. Every metric in lib/analytics builds on
 * these; change a rule here and it changes everywhere.
 */
import type { LeadStatus } from "@/lib/types";

/**
 * Forward pipeline stages, in order. `lost` is terminal and can follow any
 * stage, so it is not part of this sequence.
 */
export const STAGES = [
  "new",
  "contacted",
  "test_drive",
  "negotiation",
  "order_placed",
  "delivered",
] as const satisfies readonly LeadStatus[];
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  test_drive: "Test drive",
  negotiation: "Negotiation",
  order_placed: "Order placed",
  delivered: "Delivered",
  lost: "Lost",
};

/**
 * Open pipeline: derived status is one of these. `order_placed` without a
 * delivery is "awaiting delivery", a separate bucket, not pipeline.
 */
export const OPEN_STAGES = [
  "new",
  "contacted",
  "test_drive",
  "negotiation",
] as const satisfies readonly Stage[];
export type OpenStage = (typeof OPEN_STAGES)[number];

export function isOpenStage(status: LeadStatus): status is OpenStage {
  return (OPEN_STAGES as readonly LeadStatus[]).includes(status);
}

/**
 * Booked sale (primary KPI): a lead with an `order_placed` history entry,
 * attributed to the month of that entry's timestamp. Deliveries lag 1–5 weeks,
 * so counting deliveries would unfairly punish recent months.
 */
export const BOOKED_STAGE: Stage = "order_placed";

/** Revenue: sum of `deal_value` (INR) over booked leads. */
export const REVENUE_FIELD = "deal_value" as const;

/**
 * Thresholds for the Action Center. Kept in one place so the UI and DECISIONS.md
 * can quote them.
 */
export const THRESHOLDS = {
  /** Open lead with no history activity for this many days or more. */
  staleLeadDays: 7,
  /** Order placed but not delivered for longer than this. */
  stuckOrderDays: 21,
  /** Lead sitting in `negotiation` for this many days or more. */
  stalledNegotiationDays: 10,
} as const;

export const DAY_MS = 86_400_000;
