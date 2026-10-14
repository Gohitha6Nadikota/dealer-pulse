/**
 * Types for the DealerPulse dataset.
 *
 * `Raw*` types mirror public/data/dealership_data.json exactly (verified by
 * scripts/audit-data.ts and enforced at load time by lib/analytics/validate.ts).
 * Enriched types add fields derived in lib/analytics/enrich.ts.
 */

// ---------------------------------------------------------------------------
// Raw (as stored in the JSON)

/** Every value observed in `status` and `status_history[].status`. */
export const LEAD_STATUSES = [
  "new",
  "contacted",
  "test_drive",
  "negotiation",
  "order_placed",
  "delivered",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const REP_ROLES = ["branch_manager", "sales_officer"] as const;
export type RepRole = (typeof REP_ROLES)[number];

export type RawBranch = {
  id: string;
  name: string;
  city: string;
};

export type RawSalesRep = {
  id: string;
  name: string;
  branch_id: string;
  role: RepRole;
  /** ISO date (YYYY-MM-DD). */
  joined: string;
};

export type RawStatusEvent = {
  status: LeadStatus;
  /** ISO timestamp, UTC. */
  timestamp: string;
  note: string;
};

export type RawLead = {
  id: string;
  customer_name: string;
  phone: string;
  source: string;
  model_interested: string;
  /** Stored status. Not always consistent with history; see enrich.ts. */
  status: LeadStatus;
  assigned_to: string;
  branch_id: string;
  created_at: string;
  last_activity_at: string;
  status_history: RawStatusEvent[];
  /** ISO date (YYYY-MM-DD). */
  expected_close_date: string;
  /** INR. */
  deal_value: number;
  lost_reason: string | null;
};

export type RawTarget = {
  branch_id: string;
  /** YYYY-MM. */
  month: string;
  target_units: number;
  /** INR. */
  target_revenue: number;
};

export type RawDelivery = {
  lead_id: string;
  /** ISO date (YYYY-MM-DD). */
  order_date: string;
  /** ISO date (YYYY-MM-DD). */
  delivery_date: string;
  days_to_deliver: number;
  delay_reason: string | null;
};

export type RawDataset = {
  metadata: {
    generated_at: string;
    description: string;
    date_range: string;
    notes: string;
  };
  branches: RawBranch[];
  sales_reps: RawSalesRep[];
  leads: RawLead[];
  targets: RawTarget[];
  deliveries: RawDelivery[];
};

// ---------------------------------------------------------------------------
// Enriched (derived in lib/analytics/enrich.ts)

export type Branch = RawBranch;
export type SalesRep = RawSalesRep;
export type Target = RawTarget;
export type Delivery = RawDelivery;

/** First timestamp at which the lead reached each status, from history only. */
export type StageTimestamps = Partial<Record<LeadStatus, string>>;

export type StatusEvent = {
  status: LeadStatus;
  timestamp: string;
  /** Sanitized for display (template bugs removed). */
  note: string;
};

/**
 * `status_lost_without_event`: stored status is "lost" but history has no
 * lost entry. Treated as open (derived status wins).
 * `status_mismatch`: any other disagreement between stored and derived status.
 */
export type DataQualityIssue = "status_lost_without_event" | "status_mismatch";

export type Lead = {
  id: string;
  customerName: string;
  source: string;
  model: string;
  branchId: string;
  repId: string;
  branch: Branch;
  rep: SalesRep;
  createdAt: string;
  expectedCloseDate: string;
  /** INR. */
  dealValue: number;
  /** Status as stored in the JSON. Kept for transparency only. */
  storedStatus: LeadStatus;
  /** Source of truth: status of the last status_history entry. */
  status: LeadStatus;
  stageTimestamps: StageTimestamps;
  history: StatusEvent[];
  /** Timestamp of the order_placed entry, or null if never booked. */
  bookedAt: string | null;
  /** Timestamp of the delivered entry, or null. */
  deliveredAt: string | null;
  /** Timestamp of the lost entry, or null. */
  lostAt: string | null;
  /** Structured loss reason; the source of truth for loss analysis. */
  lostReason: string | null;
  lastActivityAt: string;
  /** Whole days from last_activity_at to AS_OF. */
  daysIdle: number;
  /** Whole days from the last history entry to AS_OF. */
  daysInStage: number;
  /** Delivery record for delivered leads, else null. */
  delivery: Delivery | null;
  dataQualityIssue: DataQualityIssue | null;
};

export type DataQualityReport = {
  /** Lead ids with status "lost" but no lost history event (treated as open). */
  statusLostWithoutEvent: string[];
  /** Lost leads whose final note names a competitor but lost_reason differs. */
  lossNoteContradictions: number;
  /** History notes containing the literal "{}" template bug (sanitized). */
  templatedNotes: number;
};

export type Dataset = {
  /** Latest timestamp in history or deliveries. "Today" for all day math. */
  asOf: string;
  /** All months covered by targets, ascending (YYYY-MM). */
  months: string[];
  branches: Branch[];
  reps: SalesRep[];
  leads: Lead[];
  targets: Target[];
  deliveries: Delivery[];
  leadsByBranch: Record<string, Lead[]>;
  leadsByRep: Record<string, Lead[]>;
  dataQuality: DataQualityReport;
};
