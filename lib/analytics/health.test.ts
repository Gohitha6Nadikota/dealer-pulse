import { describe, expect, it } from "vitest";
import { branchHealth } from "@/lib/analytics/health";
import type { Kpis } from "@/lib/analytics/kpis";

function k(overrides: Partial<Kpis>): Kpis {
  return {
    bookedUnits: 20,
    bookedRevenue: 0,
    targetUnits: null,
    targetRevenue: null,
    unitAttainment: null,
    revenueAttainment: null,
    wins: 20,
    losses: 20,
    winRate: 0.5,
    deliveredUnits: 0,
    avgDaysToDeliver: 15,
    openPipelineCount: 0,
    openPipelineValue: 0,
    awaitingDeliveryCount: 0,
    awaitingDeliveryValue: 0,
    ...overrides,
  };
}
const company = k({});

describe("branchHealth", () => {
  it("is healthy when in line with the company and its past", () => {
    expect(branchHealth({ current: k({}), previous: k({}), company })).toEqual({ level: "healthy", reasons: [] });
  });

  it("acts on a win rate far below the company", () => {
    const h = branchHealth({ current: k({ winRate: 0.14, wins: 5, losses: 31 }), previous: null, company });
    expect(h.level).toBe("act");
    expect(h.reasons[0]).toBe("Win rate 14% vs 50% company");
  });

  it("watches a moderately lower win rate", () => {
    expect(branchHealth({ current: k({ winRate: 0.42 }), previous: null, company }).level).toBe("watch");
  });

  it("acts on a sharp bookings drop and watches a mild one", () => {
    expect(branchHealth({ current: k({ bookedUnits: 14 }), previous: k({ bookedUnits: 20 }), company }).level).toBe("act");
    expect(branchHealth({ current: k({ bookedUnits: 17 }), previous: k({ bookedUnits: 20 }), company }).level).toBe("watch");
  });

  it("watches slow delivery", () => {
    const h = branchHealth({ current: k({ avgDaysToDeliver: 20 }), previous: null, company });
    expect(h).toEqual({ level: "watch", reasons: ["Delivery 20 days vs 15 days company"] });
  });

  it("does not judge win rate on too few outcomes", () => {
    expect(branchHealth({ current: k({ winRate: 0, wins: 0, losses: 3 }), previous: null, company }).level).toBe("healthy");
  });

  it("lists act reasons before watch reasons", () => {
    const h = branchHealth({ current: k({ winRate: 0.3, avgDaysToDeliver: 25 }), previous: null, company });
    expect(h.level).toBe("act");
    expect(h.reasons).toHaveLength(2);
    expect(h.reasons[0]).toMatch(/^Win rate/);
  });
});
