/** Delayed deliveries (21–90 days) vs likely stale records (90+ days). */
import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { actionItems, actionReasons, summarizeActions } from "@/lib/analytics/action-center";
import { staleOrderRecords, stuckOrders } from "@/lib/analytics/actions";
import { THRESHOLDS } from "@/lib/analytics/definitions";
import { buildDataset } from "@/lib/analytics/enrich";
import { AS_OF, rawDataset, rawLead, sampleDataset } from "@/lib/analytics/fixtures";
import { attentionFor } from "@/lib/analytics/scope";
import { parseDataset } from "@/lib/analytics/validate";
import type { Lead } from "@/lib/types";

const DAY = 86_400_000;
/** An order placed `days` before AS_OF and never delivered. */
function order(id: string, days: number, dealValue = 1_000_000) {
  const placed = new Date(Date.parse(AS_OF) - days * DAY).toISOString();
  return rawLead(id, [["new", "2025-01-01T00:00:00Z"], ["order_placed", placed]], { deal_value: dealValue });
}
const ds = buildDataset(
  rawDataset({
    leads: [
      order("O21", 21), order("O22", 22), order("O89", 89), order("O90", 90), order("O195", 195, 5_000_000),
      // An anchor so AS_OF is the fixture's.
      rawLead("A", [["new", "2025-12-30T00:00:00Z"], ["contacted", AS_OF]]),
    ],
  }),
);
const ids = (xs: { lead: Lead }[]) => xs.map((x) => x.lead.id);

describe("thresholds", () => {
  it("keeps the stale cut-off in the config, after the delay threshold", () => {
    expect(THRESHOLDS.staleOrderDays).toBe(90);
    expect(THRESHOLDS.staleOrderDays).toBeGreaterThan(THRESHOLDS.stuckOrderDays);
  });
});

describe("stuckOrders vs staleOrderRecords", () => {
  it("splits at the boundaries: > 21 and < 90 is delayed, 90+ is stale, 21 is neither", () => {
    expect(ids(stuckOrders(ds.leads))).toEqual(["O89", "O22"]);
    expect(ids(staleOrderRecords(ds.leads))).toEqual(["O195", "O90"]);
  });

  it("never puts an order in both lists", () => {
    const delayed = new Set(ids(stuckOrders(ds.leads)));
    expect(ids(staleOrderRecords(ds.leads)).some((id) => delayed.has(id))).toBe(false);
  });
});

describe("Action Center", () => {
  const items = actionItems(ds, ds.leads);
  const item = (id: string) => items.find((i) => i.leadId === id)!;

  it("routes a delayed delivery to the branch manager with 'Chase delivery'", () => {
    expect(item("O89").primary).toBe("delayed_order");
    expect(item("O89").owner.role).toBe("branch_manager");
    expect(item("O89").severity).toBe("critical"); // 89 ≥ 2 × 21
  });

  it("routes a likely stale record to the sales officer for CRM verification, as a review item", () => {
    for (const id of ["O90", "O195"]) {
      expect(item(id).reasons.map((r) => r.reason)).toEqual(["stale_order"]);
      expect(item(id).owner).toMatchObject({ id: "R1", role: "sales_officer" });
      expect(item(id).severity).toBe("review");
    }
  });

  it("excludes stale records from the value at risk but reports them separately", () => {
    const s = summarizeActions(items);
    expect(s.byReason.delayed_order).toBe(2);
    expect(s.byReason.stale_order).toBe(2);
    expect(s.value).toBe(2_000_000); // O22 + O89
    expect(s.verifyValue).toBe(6_000_000); // O90 + O195
  });

  it("leaves a 21-day order alone", () => {
    const lead = ds.leads.find((l) => l.id === "O21")!;
    expect(actionReasons(lead, ds.asOf)).toEqual([]);
  });
});

describe("Needs attention summary", () => {
  it("keeps stale records out of the at-risk total", () => {
    const a = attentionFor(ds, ds.leads);
    expect(a.stuck.count).toBe(2);
    expect(a.staleOrders.count).toBe(2);
    expect(a.valueAtRisk).toBe(2_000_000);
  });

  it("counts a lead that is both idle and a stalled negotiation once", () => {
    const sample = sampleDataset(); // L4: negotiation 30 days, also idle 30 days
    const a = attentionFor(sample, sample.leads);
    const listed = a.stale.value + a.stuck.value + a.negotiations.value;
    expect(a.valueAtRisk).toBe(listed - 4_000_000);
  });

  it("matches the real data: 14 delays, 11 stale records", () => {
    const real = buildDataset(parseDataset(rawJson as unknown));
    const a = attentionFor(real, real.leads);
    expect(a.stuck.count + a.staleOrders.count).toBe(25);
    expect(a.stuck.count).toBe(14);
    const s = summarizeActions(actionItems(real, real.leads));
    expect(s.byReason.stale_order).toBe(11);
    expect(s.bySeverity).toEqual({ critical: 11, warning: 12, review: 22 });
    // The Action Center and the Overview's "Needs attention" card agree on value at risk.
    expect(s.value).toBe(a.valueAtRisk);
  });
});
