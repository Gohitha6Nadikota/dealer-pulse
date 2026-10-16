/**
 * Action Center: one item per lead that needs someone to act, with every
 * reason that applies. Counting leads (not reasons) avoids double counting:
 * a negotiation idle for 12 days is one item with two reasons, not two items.
 *
 * Reasons, all derived from data as of AS_OF:
 *   delayed_order        order placed, not delivered, > stuckOrderDays and
 *                        < staleOrderDays                                   → branch manager
 *   stale_order          order placed, not delivered, ≥ staleOrderDays      → sales officer
 *                        (likely a stale CRM record; verify, don't chase)
 *   stalled_negotiation  in negotiation ≥ stalledNegotiationDays            → sales officer
 *   idle_lead            open, no activity ≥ staleLeadDays                   → sales officer
 *   past_close_date      open, expected_close_date before AS_OF              → sales officer
 *   status_conflict      stored "lost" but history has no loss event         → sales officer
 *
 * Severity: "critical" at twice a reason's threshold, "warning" at the
 * threshold; past_close_date is a warning; stale_order and status_conflict
 * are "review" (records to verify, not revenue at risk).
 */
import {
  ACTION_REASONS,
  SEVERITIES,
  type ActionParams,
  type ActionReason,
  type Severity,
} from "@/lib/action-params";
import { THRESHOLDS, isOpenStage } from "@/lib/analytics/definitions";
import { sumBy } from "@/lib/analytics/kpis";
import { toLeadRow } from "@/lib/analytics/lead-rows";
import { formatDate } from "@/lib/format";
import type { LeadRow } from "@/lib/lead-table";
import type { Dataset, Lead, SalesRep } from "@/lib/types";

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, review: 2 };

export type Person = { id: string; name: string; role: SalesRep["role"] };

export type ActionItem = {
  leadId: string;
  lead: LeadRow;
  branch: { id: string; name: string };
  rep: Person;
  /** Who should act on the primary reason. */
  owner: Person;
  primary: ActionReason;
  reasons: { reason: ActionReason; severity: Severity; detail: string }[];
  severity: Severity;
  /** Age in days for the primary reason (waiting, in stage or idle). */
  days: number;
  /** INR. */
  dealValue: number;
};

function person(rep: SalesRep): Person {
  return { id: rep.id, name: rep.name, role: rep.role };
}

function bySeverity(days: number, threshold: number): Severity {
  return days >= threshold * 2 ? "critical" : "warning";
}

/** Every reason that applies to a lead, in priority order. Empty if none. */
export function actionReasons(lead: Lead, asOf: string): ActionItem["reasons"] {
  const out: ActionItem["reasons"] = [];
  if (lead.status === "order_placed" && lead.daysInStage >= THRESHOLDS.staleOrderDays) {
    out.push({
      reason: "stale_order",
      severity: "review",
      detail: `Ordered ${lead.daysInStage} days ago; far beyond any recorded delivery time`,
    });
  } else if (lead.status === "order_placed" && lead.daysInStage > THRESHOLDS.stuckOrderDays) {
    out.push({
      reason: "delayed_order",
      severity: bySeverity(lead.daysInStage, THRESHOLDS.stuckOrderDays),
      detail: `Ordered ${lead.daysInStage} days ago, not delivered`,
    });
  }
  if (lead.status === "negotiation" && lead.daysInStage >= THRESHOLDS.stalledNegotiationDays) {
    out.push({
      reason: "stalled_negotiation",
      severity: bySeverity(lead.daysInStage, THRESHOLDS.stalledNegotiationDays),
      detail: `${lead.daysInStage} days in negotiation`,
    });
  }
  if (isOpenStage(lead.status)) {
    if (lead.daysIdle >= THRESHOLDS.staleLeadDays) {
      out.push({
        reason: "idle_lead",
        severity: bySeverity(lead.daysIdle, THRESHOLDS.staleLeadDays),
        detail: `No activity for ${lead.daysIdle} days`,
      });
    }
    if (Date.parse(lead.expectedCloseDate) < Date.parse(asOf)) {
      out.push({
        reason: "past_close_date",
        severity: "warning",
        detail: `Expected to close by ${formatDate(lead.expectedCloseDate)}`,
      });
    }
  }
  if (lead.dataQualityIssue === "status_lost_without_event") {
    out.push({
      reason: "status_conflict",
      severity: "review",
      detail: "Stored as lost, but history has no loss event or loss reason",
    });
  }
  return out;
}

function worst(severities: Severity[]): Severity {
  return severities.reduce((a, b) => (SEVERITY_RANK[b] < SEVERITY_RANK[a] ? b : a), "review" as Severity);
}

/** One item per lead needing action, most urgent first (severity, then value × days). */
export function actionItems(ds: Dataset, leads: Lead[]): ActionItem[] {
  const managers = new Map(
    ds.reps.filter((r) => r.role === "branch_manager").map((r) => [r.branch_id, r]),
  );
  const items: ActionItem[] = [];
  for (const lead of leads) {
    const reasons = actionReasons(lead, ds.asOf);
    if (!reasons.length) continue;
    const primary = reasons[0].reason;
    const manager = managers.get(lead.branchId);
    const owner = primary === "delayed_order" && manager ? manager : lead.rep;
    items.push({
      leadId: lead.id,
      lead: toLeadRow(lead),
      branch: { id: lead.branch.id, name: lead.branch.name },
      rep: person(lead.rep),
      owner: person(owner),
      primary,
      reasons,
      severity: worst(reasons.map((r) => r.severity)),
      days: primary === "idle_lead" || primary === "past_close_date" || primary === "status_conflict"
        ? lead.daysIdle
        : lead.daysInStage,
      dealValue: lead.dealValue,
    });
  }
  return items.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.dealValue * b.days - a.dealValue * a.days ||
      a.leadId.localeCompare(b.leadId),
  );
}

export type ActionGroup = { id: string; name: string; count: number; critical: number; /** INR. */ value: number };

export type ActionSummary = {
  /** Unique leads. */
  total: number;
  /**
   * INR at risk, each lead counted once: items needing action now or soon.
   * Review-only items (likely stale records, status conflicts) are excluded.
   */
  value: number;
  /** INR on review-only items: records to verify in the CRM, reported separately. */
  verifyValue: number;
  bySeverity: Record<Severity, number>;
  /** Leads with each reason. A lead can have several, so these can sum to more than total. */
  byReason: Record<ActionReason, number>;
  byBranch: ActionGroup[];
  byOwner: (ActionGroup & { role: SalesRep["role"] })[];
};

function group<K extends string>(
  items: ActionItem[],
  key: (i: ActionItem) => { id: K; name: string },
): (ActionGroup & { id: K })[] {
  const map = new Map<K, ActionGroup & { id: K }>();
  for (const item of items) {
    const { id, name } = key(item);
    const g = map.get(id) ?? { id, name, count: 0, critical: 0, value: 0 };
    g.count += 1;
    g.critical += item.severity === "critical" ? 1 : 0;
    g.value += item.dealValue;
    map.set(id, g);
  }
  return [...map.values()].sort((a, b) => b.critical - a.critical || b.count - a.count || b.value - a.value);
}

export function summarizeActions(items: ActionItem[]): ActionSummary {
  const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
  const byReason = Object.fromEntries(ACTION_REASONS.map((r) => [r, 0])) as Record<ActionReason, number>;
  for (const item of items) {
    bySeverity[item.severity] += 1;
    for (const r of item.reasons) byReason[r.reason] += 1;
  }
  const roles = new Map(items.map((i) => [i.owner.id, i.owner.role]));
  return {
    total: items.length,
    value: sumBy(items.filter((i) => i.severity !== "review"), (i) => i.dealValue),
    verifyValue: sumBy(items.filter((i) => i.severity === "review"), (i) => i.dealValue),
    bySeverity,
    byReason,
    byBranch: group(items, (i) => i.branch),
    byOwner: group(items, (i) => ({ id: i.owner.id, name: i.owner.name })).map((g) => ({
      ...g,
      role: roles.get(g.id) ?? "sales_officer",
    })),
  };
}

export type ActionFilters = ActionParams & { branchId: string | null };

export function filterActions(items: ActionItem[], f: ActionFilters): ActionItem[] {
  return items.filter(
    (i) =>
      (!f.branchId || i.branch.id === f.branchId) &&
      (!f.reason || i.reasons.some((r) => r.reason === f.reason)) &&
      (!f.severity || i.severity === f.severity) &&
      (!f.ownerId || i.owner.id === f.ownerId || i.rep.id === f.ownerId),
  );
}
