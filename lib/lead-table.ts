/**
 * Lead table rows and their filtering/sorting. Pure and serializable so the
 * server builds rows and the client table only filters what it was given.
 */
import { STAGES } from "@/lib/analytics/definitions";
import type { DataQualityIssue, LeadStatus, StatusEvent } from "@/lib/types";

export type LeadBucket = "open" | "awaiting" | "delivered" | "lost";

export type LeadRow = {
  id: string;
  customer: string;
  model: string;
  source: string;
  status: LeadStatus;
  bucket: LeadBucket;
  /** INR. */
  dealValue: number;
  createdAt: string;
  lastActivityAt: string;
  /** Meaningful for open leads only. */
  daysIdle: number;
  /** Open and idle at least THRESHOLDS.staleLeadDays. */
  stale: boolean;
  daysInStage: number;
  /** Most recent history note, sanitized. */
  lastNote: string;
  rep: { id: string; name: string };
  lostReason: string | null;
  delivery: { daysToDeliver: number; delayReason: string | null } | null;
  dataQualityIssue: DataQualityIssue | null;
  /** Stored as lost with no loss event (see lib/analytics/status-conflicts.ts). */
  statusConflict: boolean;
  history: StatusEvent[];
};

export const BUCKET_LABELS: Record<LeadBucket, string> = {
  open: "Open",
  awaiting: "Awaiting delivery",
  delivered: "Delivered",
  lost: "Lost",
};

export function bucketOf(status: LeadStatus): LeadBucket {
  if (status === "order_placed") return "awaiting";
  if (status === "delivered") return "delivered";
  if (status === "lost") return "lost";
  return "open";
}

export type SortKey = "customer" | "stage" | "value" | "idle" | "created";
export type SortDir = "asc" | "desc";

/** Sensible first direction when a column is clicked: biggest/oldest first for numbers. */
export const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  customer: "asc",
  stage: "desc",
  value: "desc",
  idle: "desc",
  created: "desc",
};

function stageRank(status: LeadStatus): number {
  // Lost sorts below every forward stage.
  return status === "lost" ? -1 : (STAGES as readonly LeadStatus[]).indexOf(status);
}

/** Case-insensitive match on customer, lead id, model or rep. */
export function searchLeads(rows: LeadRow[], query: string): LeadRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) =>
    [r.customer, r.id, r.model, r.rep.name].some((field) => field.toLowerCase().includes(q)),
  );
}

export function filterLeads(
  rows: LeadRow[],
  { bucket, query }: { bucket: LeadBucket | "all"; query: string },
): LeadRow[] {
  const inBucket = bucket === "all" ? rows : rows.filter((r) => r.bucket === bucket);
  return searchLeads(inBucket, query);
}

export function sortLeads(rows: LeadRow[], key: SortKey, dir: SortDir): LeadRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const value = (r: LeadRow): number | string => {
    switch (key) {
      case "customer":
        return r.customer.toLowerCase();
      case "stage":
        return stageRank(r.status);
      case "value":
        return r.dealValue;
      case "idle":
        // Closed leads aren't idle; keep them after open ones whichever way we sort.
        return r.bucket === "open" ? r.daysIdle : dir === "desc" ? -1 : Number.MAX_SAFE_INTEGER;
      case "created":
        return r.createdAt;
    }
  };
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va < vb) return -1 * sign;
    if (va > vb) return 1 * sign;
    return a.id.localeCompare(b.id);
  });
}

export function bucketCounts(rows: LeadRow[]): Record<LeadBucket | "all", number> {
  const counts = { all: rows.length, open: 0, awaiting: 0, delivered: 0, lost: 0 };
  for (const r of rows) counts[r.bucket] += 1;
  return counts;
}
