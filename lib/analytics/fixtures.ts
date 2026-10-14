/** Small hand-built datasets for unit tests. Not imported by app code. */
import { buildDataset } from "@/lib/analytics/enrich";
import type {
  Dataset,
  LeadStatus,
  RawDataset,
  RawDelivery,
  RawLead,
  RawTarget,
} from "@/lib/types";

export const AS_OF = "2025-12-31T12:00:00Z";

export function rawLead(
  id: string,
  history: [LeadStatus, string][],
  overrides: Partial<RawLead> = {},
): RawLead {
  const last = history[history.length - 1];
  return {
    id,
    customer_name: `Customer ${id}`,
    phone: "9000000000",
    source: "walk_in",
    model_interested: "Glanza",
    status: last[0],
    assigned_to: "R1",
    branch_id: "B1",
    created_at: history[0][1],
    last_activity_at: last[1],
    status_history: history.map(([status, timestamp]) => ({ status, timestamp, note: "" })),
    expected_close_date: "2026-01-31",
    deal_value: 1_000_000,
    lost_reason: last[0] === "lost" ? "Budget constraints" : null,
    ...overrides,
  };
}

export function rawDataset(parts: {
  leads?: RawLead[];
  targets?: RawTarget[];
  deliveries?: RawDelivery[];
}): RawDataset {
  return {
    metadata: { generated_at: AS_OF, description: "test", date_range: "test", notes: "test" },
    branches: [
      { id: "B1", name: "Alpha Toyota", city: "Chennai" },
      { id: "B2", name: "Beta Toyota", city: "Mumbai" },
    ],
    sales_reps: [
      { id: "M1", name: "Manager One", branch_id: "B1", role: "branch_manager", joined: "2023-01-01" },
      { id: "R1", name: "Rep One", branch_id: "B1", role: "sales_officer", joined: "2023-01-01" },
      { id: "R2", name: "Rep Two", branch_id: "B1", role: "sales_officer", joined: "2023-01-01" },
      { id: "R3", name: "Rep Three", branch_id: "B2", role: "sales_officer", joined: "2023-01-01" },
    ],
    leads: parts.leads ?? [],
    targets: parts.targets ?? [],
    deliveries: parts.deliveries ?? [],
  };
}

/**
 * A ready-made dataset covering the usual shapes. A sentinel lead pins
 * AS_OF to 2025-12-31T12:00Z.
 *  L1 R1 B1: full journey, booked Oct 10, delivered Oct 30 (20 days, delayed)
 *  L2 R1 B1: booked Nov 5, still awaiting delivery
 *  L3 R1 B1: lost straight from "new" in Oct
 *  L4 R2 B1: negotiation since Dec 1 (stalled)
 *  L5 R2 B1: new lead, never contacted, idle since Dec 20
 *  L6 R2 B1: stored "lost" but history ends at contacted (data quality)
 *  L7 R3 B2: lost after test drive in Nov, deal 2,000,000
 *  L8 R3 B2: sentinel, contacted at AS_OF
 */
export function sampleDataset(): Dataset {
  const leads = [
    rawLead("L1", [
      ["new", "2025-09-20T10:00:00Z"],
      ["contacted", "2025-09-22T10:00:00Z"],
      ["test_drive", "2025-09-28T10:00:00Z"],
      ["negotiation", "2025-10-02T10:00:00Z"],
      ["order_placed", "2025-10-10T10:00:00Z"],
      ["delivered", "2025-10-30T10:00:00Z"],
    ], { deal_value: 3_000_000 }),
    rawLead("L2", [
      ["new", "2025-10-20T10:00:00Z"],
      ["contacted", "2025-10-21T10:00:00Z"],
      ["test_drive", "2025-10-25T10:00:00Z"],
      ["negotiation", "2025-10-30T10:00:00Z"],
      ["order_placed", "2025-11-05T10:00:00Z"],
    ], { deal_value: 2_000_000 }),
    rawLead("L3", [
      ["new", "2025-10-01T10:00:00Z"],
      ["lost", "2025-10-04T10:00:00Z"],
    ]),
    rawLead("L4", [
      ["new", "2025-11-10T10:00:00Z"],
      ["contacted", "2025-11-12T10:00:00Z"],
      ["test_drive", "2025-11-20T10:00:00Z"],
      ["negotiation", "2025-12-01T10:00:00Z"],
    ], { assigned_to: "R2", deal_value: 4_000_000 }),
    rawLead("L5", [["new", "2025-12-20T10:00:00Z"]], { assigned_to: "R2" }),
    rawLead("L6", [
      ["new", "2025-12-01T10:00:00Z"],
      ["contacted", "2025-12-02T10:00:00Z"],
    ], { assigned_to: "R2", status: "lost", lost_reason: null }),
    rawLead("L7", [
      ["new", "2025-11-01T10:00:00Z"],
      ["contacted", "2025-11-02T10:00:00Z"],
      ["test_drive", "2025-11-05T10:00:00Z"],
      ["lost", "2025-11-08T10:00:00Z"],
    ], { assigned_to: "R3", branch_id: "B2", deal_value: 2_000_000, lost_reason: "Chose competitor brand" }),
    rawLead("L8", [
      ["new", "2025-12-30T12:00:00Z"],
      ["contacted", AS_OF],
    ], { assigned_to: "R3", branch_id: "B2" }),
  ];
  return buildDataset(
    rawDataset({
      leads,
      targets: [
        { branch_id: "B1", month: "2025-10", target_units: 4, target_revenue: 8_000_000 },
        { branch_id: "B1", month: "2025-11", target_units: 4, target_revenue: 8_000_000 },
        { branch_id: "B2", month: "2025-10", target_units: 2, target_revenue: 4_000_000 },
        { branch_id: "B2", month: "2025-11", target_units: 2, target_revenue: 4_000_000 },
      ],
      deliveries: [
        {
          lead_id: "L1",
          order_date: "2025-10-10",
          delivery_date: "2025-10-30",
          days_to_deliver: 20,
          delay_reason: "RTO registration delay",
        },
      ],
    }),
  );
}
