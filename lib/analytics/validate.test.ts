import { describe, expect, it } from "vitest";
import { rawDataset, rawLead } from "@/lib/analytics/fixtures";
import { DataValidationError, parseDataset } from "@/lib/analytics/validate";

const valid = () =>
  rawDataset({
    leads: [rawLead("L1", [["new", "2025-12-01T00:00:00Z"], ["contacted", "2025-12-02T00:00:00Z"]])],
    targets: [{ branch_id: "B1", month: "2025-12", target_units: 1, target_revenue: 1 }],
    deliveries: [],
  });

/** Clone a valid dataset, apply a mutation, and expect parsing to fail with `message`. */
function expectInvalid(mutate: (d: ReturnType<typeof valid>) => void, message: RegExp) {
  const data = structuredClone(valid());
  mutate(data);
  expect(() => parseDataset(data)).toThrow(DataValidationError);
  expect(() => parseDataset(data)).toThrow(message);
}

describe("parseDataset", () => {
  it("accepts a valid dataset", () => {
    expect(parseDataset(valid()).leads).toHaveLength(1);
  });

  it("rejects non-objects", () => {
    expect(() => parseDataset(null)).toThrow(/\$: expected an object/);
    expect(() => parseDataset([])).toThrow(DataValidationError);
  });

  it("rejects a missing collection", () => {
    expectInvalid((d) => Reflect.deleteProperty(d, "leads"), /\$\.leads: expected an array/);
  });

  it("rejects an unknown status", () => {
    expectInvalid(
      (d) => Reflect.set(d.leads[0].status_history[0], "status", "won"),
      /status_history\[0\]\.status: unknown value "won"/,
    );
  });

  it("rejects an empty history", () => {
    expectInvalid((d) => (d.leads[0].status_history = []), /at least one entry/);
  });

  it("rejects out-of-order history", () => {
    expectInvalid((d) => d.leads[0].status_history.reverse(), /not in time order/);
  });

  it("rejects an unparseable timestamp", () => {
    expectInvalid((d) => (d.leads[0].created_at = "yesterday"), /created_at: unparseable/);
  });

  it("rejects a negative or non-numeric deal value", () => {
    expectInvalid((d) => (d.leads[0].deal_value = -5), /deal_value/);
    expectInvalid((d) => Reflect.set(d.leads[0], "deal_value", "100"), /deal_value/);
  });

  it("rejects a malformed target month", () => {
    expectInvalid((d) => (d.targets[0].month = "2025-13"), /expected YYYY-MM/);
  });

  it("rejects duplicate ids", () => {
    expectInvalid((d) => d.leads.push(structuredClone(d.leads[0])), /duplicate id "L1"/);
  });

  it("rejects broken references", () => {
    expectInvalid((d) => (d.leads[0].branch_id = "B9"), /unknown branch "B9"/);
    expectInvalid((d) => (d.leads[0].assigned_to = "R9"), /unknown rep "R9"/);
    expectInvalid(
      (d) =>
        d.deliveries.push({ lead_id: "L9", order_date: "2025-12-01", delivery_date: "2025-12-05", days_to_deliver: 4, delay_reason: null }),
      /unknown lead "L9"/,
    );
  });

  it("rejects a lead assigned to a rep from another branch", () => {
    expectInvalid((d) => (d.leads[0].assigned_to = "R3"), /belongs to B2/);
  });

  it("treats a missing note or lost_reason as empty / null", () => {
    const d = structuredClone(valid());
    Reflect.deleteProperty(d.leads[0].status_history[0], "note");
    Reflect.deleteProperty(d.leads[0], "lost_reason");
    const parsed = parseDataset(d);
    expect(parsed.leads[0].status_history[0].note).toBe("");
    expect(parsed.leads[0].lost_reason).toBeNull();
  });
});
