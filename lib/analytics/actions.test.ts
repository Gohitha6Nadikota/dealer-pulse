import { describe, expect, it } from "vitest";
import { delayReasons, stalledNegotiations, staleLeads, stuckOrders } from "@/lib/analytics/actions";
import { sampleDataset } from "@/lib/analytics/fixtures";

const ds = sampleDataset();
const ids = (items: { lead: { id: string } }[]) => items.map((i) => i.lead.id);

describe("staleLeads", () => {
  it("lists open leads idle at least the threshold, by value × days idle", () => {
    const stale = staleLeads(ds.leads);
    expect(ids(stale)).toEqual(["L4", "L6", "L5"]);
    expect(stale[0]).toMatchObject({ daysIdle: 30, valueAtRisk: 4_000_000, priority: 120_000_000 });
  });

  it("excludes closed and awaiting-delivery leads", () => {
    const stale = ids(staleLeads(ds.leads, 0));
    expect(stale).not.toContain("L1");
    expect(stale).not.toContain("L2");
    expect(stale).not.toContain("L3");
    expect(stale).toContain("L8");
  });

  it("returns nothing for no leads", () => {
    expect(staleLeads([])).toEqual([]);
  });
});

describe("stuckOrders", () => {
  it("lists undelivered orders waiting more than the threshold", () => {
    expect(stuckOrders(ds.leads)).toEqual([{ lead: expect.objectContaining({ id: "L2" }), daysWaiting: 56 }]);
    expect(stuckOrders(ds.leads, 56)).toEqual([]);
  });
});

describe("stalledNegotiations", () => {
  it("lists leads in negotiation at least the threshold", () => {
    expect(ids(stalledNegotiations(ds.leads))).toEqual(["L4"]);
    expect(stalledNegotiations(ds.leads, 31)).toEqual([]);
  });
});

describe("delayReasons", () => {
  it("summarises delivery delay reasons", () => {
    expect(delayReasons(ds.leads)).toEqual({
      delivered: 1,
      delayed: 1,
      avgDaysWithReason: 20,
      avgDaysWithoutReason: null,
      reasons: [{ reason: "RTO registration delay", count: 1, avgDays: 20 }],
    });
  });
});
