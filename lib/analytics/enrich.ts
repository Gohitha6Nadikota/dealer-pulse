/**
 * Turns the validated raw dataset into enriched leads plus lookups.
 * Pure: same input, same output. "Today" is AS_OF from the data, never the
 * wall clock, so numbers don't drift as real time passes.
 */
import { DAY_MS } from "@/lib/analytics/definitions";
import type {
  DataQualityIssue,
  Dataset,
  Delivery,
  Lead,
  LeadStatus,
  RawDataset,
  RawLead,
  StageTimestamps,
} from "@/lib/types";

/** Latest timestamp anywhere in lead activity, history or deliveries. */
export function computeAsOf(raw: Pick<RawDataset, "leads" | "deliveries">): string {
  let max = -Infinity;
  for (const lead of raw.leads) {
    max = Math.max(max, Date.parse(lead.last_activity_at));
    for (const event of lead.status_history) max = Math.max(max, Date.parse(event.timestamp));
  }
  for (const d of raw.deliveries) {
    max = Math.max(max, Date.parse(d.order_date), Date.parse(d.delivery_date));
  }
  if (!Number.isFinite(max)) throw new Error("Cannot compute AS_OF from an empty dataset");
  return new Date(max).toISOString();
}

/** Whole days between `from` and `asOf`, never negative. */
export function daysBetween(from: string, asOf: string): number {
  return Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(from)) / DAY_MS));
}

/**
 * Fix the "{}" template bug found in notes
 * ("Customer comparing with {} competitor" → "…with a competitor").
 */
export function sanitizeNote(note: string): string {
  return note
    .replace(/\{\}\s*competitor/g, "a competitor")
    .replace(/\{\}/g, "…")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const COMPETITOR_NOTE = /went with|competitor/i;
const COMPETITOR_REASONS = new Set(["Chose competitor brand", "Better offer elsewhere"]);

/** True when the final lost note names a competitor but lost_reason disagrees. */
export function lossNoteContradicts(lead: RawLead): boolean {
  const lost = lead.status_history.find((e) => e.status === "lost");
  if (!lost || lead.lost_reason === null) return false;
  return COMPETITOR_NOTE.test(lost.note) && !COMPETITOR_REASONS.has(lead.lost_reason);
}

/** First time each status appears in history. Reach is never inferred from `status`. */
export function stageTimestamps(lead: RawLead): StageTimestamps {
  const out: StageTimestamps = {};
  for (const event of lead.status_history) {
    out[event.status] ??= event.timestamp;
  }
  return out;
}

/** True status = last history entry. */
export function deriveStatus(lead: RawLead): LeadStatus {
  return lead.status_history[lead.status_history.length - 1].status;
}

function dataQualityIssue(lead: RawLead, derived: LeadStatus): DataQualityIssue | null {
  if (lead.status === derived) return null;
  if (lead.status === "lost" && !lead.status_history.some((e) => e.status === "lost")) {
    return "status_lost_without_event";
  }
  return "status_mismatch";
}

export function enrichLead(
  raw: RawLead,
  ctx: {
    asOf: string;
    branch: Lead["branch"];
    rep: Lead["rep"];
    delivery: Delivery | null;
  },
): Lead {
  const status = deriveStatus(raw);
  const stamps = stageTimestamps(raw);
  const lastEvent = raw.status_history[raw.status_history.length - 1];
  return {
    id: raw.id,
    customerName: raw.customer_name,
    source: raw.source,
    model: raw.model_interested,
    branchId: raw.branch_id,
    repId: raw.assigned_to,
    branch: ctx.branch,
    rep: ctx.rep,
    createdAt: raw.created_at,
    expectedCloseDate: raw.expected_close_date,
    dealValue: raw.deal_value,
    storedStatus: raw.status,
    status,
    stageTimestamps: stamps,
    history: raw.status_history.map((e) => ({
      status: e.status,
      timestamp: e.timestamp,
      note: sanitizeNote(e.note),
    })),
    bookedAt: stamps.order_placed ?? null,
    deliveredAt: stamps.delivered ?? null,
    lostAt: stamps.lost ?? null,
    // Only trust a loss reason when history confirms the loss.
    lostReason: stamps.lost ? raw.lost_reason : null,
    lastActivityAt: raw.last_activity_at,
    daysIdle: daysBetween(raw.last_activity_at, ctx.asOf),
    daysInStage: daysBetween(lastEvent.timestamp, ctx.asOf),
    delivery: ctx.delivery,
    dataQualityIssue: dataQualityIssue(raw, status),
  };
}

function groupBy<T>(items: T[], key: (item: T) => string, seed: string[]): Record<string, T[]> {
  const out: Record<string, T[]> = Object.fromEntries(seed.map((k) => [k, [] as T[]]));
  for (const item of items) (out[key(item)] ??= []).push(item);
  return out;
}

/** Build the full enriched dataset. Expects input already passed through parseDataset. */
export function buildDataset(raw: RawDataset): Dataset {
  const asOf = computeAsOf(raw);
  const branches = new Map(raw.branches.map((b) => [b.id, b]));
  const reps = new Map(raw.sales_reps.map((r) => [r.id, r]));
  const deliveries = new Map(raw.deliveries.map((d) => [d.lead_id, d]));

  const leads = raw.leads.map((l) => {
    const branch = branches.get(l.branch_id);
    const rep = reps.get(l.assigned_to);
    if (!branch || !rep) throw new Error(`Lead ${l.id} has unresolved branch or rep`);
    return enrichLead(l, { asOf, branch, rep, delivery: deliveries.get(l.id) ?? null });
  });

  const months = [...new Set(raw.targets.map((t) => t.month))].sort();

  return {
    asOf,
    months,
    branches: raw.branches,
    reps: raw.sales_reps,
    leads,
    targets: raw.targets,
    deliveries: raw.deliveries,
    leadsByBranch: groupBy(leads, (l) => l.branchId, raw.branches.map((b) => b.id)),
    leadsByRep: groupBy(leads, (l) => l.repId, raw.sales_reps.map((r) => r.id)),
    dataQuality: {
      statusLostWithoutEvent: leads
        .filter((l) => l.dataQualityIssue === "status_lost_without_event")
        .map((l) => l.id),
      lossNoteContradictions: raw.leads.filter(lossNoteContradicts).length,
      templatedNotes: raw.leads.reduce(
        (n, l) => n + l.status_history.filter((e) => e.note.includes("{}")).length,
        0,
      ),
    },
  };
}

