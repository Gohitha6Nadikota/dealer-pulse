/**
 * Action Center vocabulary and URL params (?reason=, ?severity=, ?owner=),
 * kept free of analytics imports so the client filter bar can use it.
 * The branch and date range use the global filters in lib/filters.ts.
 */
import { filtersToQuery, type Filters, type SearchParams } from "@/lib/filters";

export const ACTION_REASONS = [
  "delayed_order",
  "stalled_negotiation",
  "idle_lead",
  "past_close_date",
  "status_conflict",
] as const;
export type ActionReason = (typeof ACTION_REASONS)[number];

export const REASON_LABELS: Record<ActionReason, string> = {
  delayed_order: "Delayed delivery",
  stalled_negotiation: "Stalled negotiation",
  idle_lead: "Idle lead",
  past_close_date: "Past expected close",
  status_conflict: "Status conflict",
};

/** The next step for the owner, by primary reason. */
export const REASON_ACTIONS: Record<ActionReason, string> = {
  delayed_order: "Chase delivery and update the customer",
  stalled_negotiation: "Push to a decision on price or terms",
  idle_lead: "Follow up with the customer",
  past_close_date: "Re-confirm timing and update the close date",
  status_conflict: "Correct the lead status in the CRM",
};

export const SEVERITIES = ["critical", "warning", "review"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Act now",
  warning: "Watch",
  review: "Review",
};

export type ActionParams = {
  reason: ActionReason | null;
  severity: Severity | null;
  /** Matches the owner or the assigned sales officer. */
  ownerId: string | null;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Unknown values fall back to "no filter". */
export function parseActionParams(params: SearchParams, ownerIds: string[]): ActionParams {
  const reason = first(params.reason);
  const severity = first(params.severity);
  const owner = first(params.owner);
  return {
    reason: (ACTION_REASONS as readonly string[]).includes(reason ?? "") ? (reason as ActionReason) : null,
    severity: (SEVERITIES as readonly string[]).includes(severity ?? "") ? (severity as Severity) : null,
    ownerId: owner && ownerIds.includes(owner) ? owner : null,
  };
}

/** /actions URL for the given global filters and action params. */
export function actionsHref(filters: Filters, params: Partial<ActionParams> = {}): string {
  const query = new URLSearchParams(filtersToQuery(filters));
  if (params.reason) query.set("reason", params.reason);
  if (params.severity) query.set("severity", params.severity);
  if (params.ownerId) query.set("owner", params.ownerId);
  const text = query.toString();
  return `/actions${text ? `?${text}` : ""}`;
}
