import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { actionsHref, parseActionParams } from "@/lib/action-params";
import { actionItems, actionReasons, filterActions, summarizeActions } from "@/lib/analytics/action-center";
import { buildActionCenter } from "@/lib/analytics/actions-view";
import { buildDataset } from "@/lib/analytics/enrich";
import { sampleDataset } from "@/lib/analytics/fixtures";
import { staleLeads, stalledNegotiations, stuckOrders } from "@/lib/analytics/actions";
import { parseDataset } from "@/lib/analytics/validate";
import { parseFilters } from "@/lib/filters";

const ds = sampleDataset();
const items = actionItems(ds, ds.leads);
const item = (id: string) => items.find((i) => i.leadId === id)!;

describe("actionItems (fixture)", () => {
  it("creates one item per lead, never one per reason", () => {
    expect(items.map((i) => i.leadId)).toEqual(["L4", "L2", "L6", "L5"]);
    expect(item("L4").reasons.map((r) => r.reason)).toEqual(["stalled_negotiation", "idle_lead"]);
  });

  it("orders by severity, then deal value × days", () => {
    // L4 4M × 30d > L2 2M × 56d > L6 1M × 29d, all critical; L5 is a warning.
    expect(items.map((i) => i.severity)).toEqual(["critical", "critical", "critical", "warning"]);
  });

  it("sets severity at twice a threshold", () => {
    expect(item("L2").reasons[0]).toMatchObject({ reason: "delayed_order", severity: "critical" }); // 56 ≥ 42
    expect(item("L5").reasons[0]).toMatchObject({ reason: "idle_lead", severity: "warning" }); // 11 < 14
  });

  it("routes delayed deliveries to the branch manager, the rest to the officer", () => {
    expect(item("L2").owner).toMatchObject({ id: "M1", role: "branch_manager" });
    expect(item("L2").rep.id).toBe("R1");
    expect(item("L4").owner.id).toBe("R2");
  });

  it("adds a status conflict as an extra reason without hiding the real one", () => {
    expect(item("L6").primary).toBe("idle_lead");
    expect(item("L6").reasons.map((r) => r.reason)).toEqual(["idle_lead", "status_conflict"]);
    expect(item("L6").severity).toBe("critical");
  });

  it("flags open leads past their expected close date", () => {
    const lead = { ...ds.leads.find((l) => l.id === "L8")!, expectedCloseDate: "2025-12-01" };
    expect(actionReasons(lead, ds.asOf).map((r) => r.reason)).toEqual(["past_close_date"]);
  });

  it("gives a status conflict alone a review severity", () => {
    const lead = { ...ds.leads.find((l) => l.id === "L8")!, dataQualityIssue: "status_lost_without_event" as const };
    expect(actionReasons(lead, ds.asOf)).toEqual([expect.objectContaining({ reason: "status_conflict", severity: "review" })]);
  });

  it("ignores closed leads", () => {
    expect(items.some((i) => ["L1", "L3", "L7", "L8"].includes(i.leadId))).toBe(false);
  });
});

describe("summarizeActions", () => {
  const s = summarizeActions(items);
  it("counts leads once but reasons per lead", () => {
    expect(s.total).toBe(4);
    expect(s.value).toBe(4_000_000 + 2_000_000 + 1_000_000 + 1_000_000);
    expect(s.byReason).toEqual({
      delayed_order: 1,
      stale_order: 0,
      stalled_negotiation: 1,
      idle_lead: 3,
      past_close_date: 0,
      status_conflict: 1,
    });
    expect(s.bySeverity).toEqual({ critical: 3, warning: 1, review: 0 });
  });
  it("groups by owner and branch, most critical first", () => {
    expect(s.byOwner[0]).toMatchObject({ id: "R2", count: 3, critical: 2 });
    expect(s.byBranch).toEqual([expect.objectContaining({ id: "B1", count: 4 })]);
  });
});

describe("filters and URL params", () => {
  it("filters by reason, severity, branch and person", () => {
    expect(filterActions(items, { branchId: null, reason: "idle_lead", severity: null, ownerId: null })).toHaveLength(3);
    expect(filterActions(items, { branchId: null, reason: null, severity: "warning", ownerId: null })).toHaveLength(1);
    expect(filterActions(items, { branchId: "B2", reason: null, severity: null, ownerId: null })).toHaveLength(0);
    // A person sees items they own and items on leads assigned to them.
    expect(filterActions(items, { branchId: null, reason: null, severity: null, ownerId: "R1" }).map((i) => i.leadId)).toEqual(["L2"]);
  });

  it("parses params forgivingly and builds shareable links", () => {
    expect(parseActionParams({ reason: "idle_lead", severity: "loud", owner: "R9" }, ["R1"])).toEqual({
      reason: "idle_lead",
      severity: null,
      ownerId: null,
    });
    const filters = parseFilters({ branch: "B1", range: "6m" }, { months: ds.months, branchIds: ["B1", "B2"] });
    expect(actionsHref(filters, { reason: "delayed_order", ownerId: "M1" })).toBe(
      "/actions?range=6m&branch=B1&reason=delayed_order&owner=M1",
    );
  });

  it("reports facet counts with the other filters applied", () => {
    const filters = parseFilters({}, { months: ds.months, branchIds: ["B1", "B2"] });
    const view = buildActionCenter(ds, filters, { reason: null, severity: "critical", ownerId: null });
    expect(view.items).toHaveLength(3);
    expect(view.facets.reason.idle_lead).toBe(2); // L4 and L6 are critical with an idle reason
    expect(view.facets.severity.warning).toBe(1);
    expect(view.unfilteredTotal).toBe(4);
  });
});

describe("real dataset", () => {
  const real = buildDataset(parseDataset(rawJson as unknown));
  const all = actionItems(real, real.leads);
  const s = summarizeActions(all);

  it("reconciles with the individual action lists and the data-quality count", () => {
    expect(s.byReason.delayed_order).toBe(stuckOrders(real.leads).length);
    expect(s.byReason.idle_lead).toBe(staleLeads(real.leads).length);
    expect(s.byReason.stalled_negotiation).toBe(stalledNegotiations(real.leads).length);
    expect(s.byReason.status_conflict).toBe(real.dataQuality.statusLostWithoutEvent.length);
  });

  it("has unique leads and fewer items than the sum of reasons", () => {
    expect(new Set(all.map((i) => i.leadId)).size).toBe(all.length);
    const reasonTotal = Object.values(s.byReason).reduce((a, b) => a + b, 0);
    expect(all.length).toBeLessThan(reasonTotal);
    expect(s.total).toBe(45);
  });
});
