/** Converts enriched leads to the slim, serializable rows the lead table receives. */
import { THRESHOLDS, isOpenStage } from "@/lib/analytics/definitions";
import { isStatusConflict } from "@/lib/analytics/status-conflicts";
import { bucketOf, type LeadRow } from "@/lib/lead-table";
import type { Lead } from "@/lib/types";

export function toLeadRow(lead: Lead): LeadRow {
  const last = lead.history[lead.history.length - 1];
  return {
    id: lead.id,
    customer: lead.customerName,
    model: lead.model,
    source: lead.source,
    status: lead.status,
    bucket: bucketOf(lead.status),
    dealValue: lead.dealValue,
    createdAt: lead.createdAt,
    lastActivityAt: lead.lastActivityAt,
    daysIdle: lead.daysIdle,
    stale: isOpenStage(lead.status) && lead.daysIdle >= THRESHOLDS.staleLeadDays,
    daysInStage: lead.daysInStage,
    lastNote: last?.note ?? "",
    rep: { id: lead.rep.id, name: lead.rep.name },
    lostReason: lead.lostReason,
    delivery: lead.delivery
      ? { daysToDeliver: lead.delivery.days_to_deliver, delayReason: lead.delivery.delay_reason }
      : null,
    dataQualityIssue: lead.dataQualityIssue,
    statusConflict: isStatusConflict(lead),
    history: lead.history,
  };
}
