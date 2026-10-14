import { describe, expect, it } from "vitest";
import {
  buildDataset,
  computeAsOf,
  daysBetween,
  deriveStatus,
  lossNoteContradicts,
  sanitizeNote,
  stageTimestamps,
} from "@/lib/analytics/enrich";
import { AS_OF, rawDataset, rawLead, sampleDataset } from "@/lib/analytics/fixtures";

describe("computeAsOf", () => {
  it("is the latest timestamp across history, activity and deliveries", () => {
    const raw = rawDataset({
      leads: [rawLead("L1", [["new", "2025-06-01T00:00:00Z"]])],
      deliveries: [
        { lead_id: "L1", order_date: "2025-06-02", delivery_date: "2025-07-01", days_to_deliver: 29, delay_reason: null },
      ],
    });
    expect(computeAsOf(raw)).toBe("2025-07-01T00:00:00.000Z");
  });

  it("throws on an empty dataset rather than defaulting to now", () => {
    expect(() => computeAsOf({ leads: [], deliveries: [] })).toThrow(/empty/);
  });
});

describe("daysBetween", () => {
  it("floors partial days and never goes negative", () => {
    expect(daysBetween("2025-12-30T13:00:00Z", AS_OF)).toBe(0);
    expect(daysBetween("2025-12-30T11:00:00Z", AS_OF)).toBe(1);
    expect(daysBetween("2026-01-05T00:00:00Z", AS_OF)).toBe(0);
  });
});

describe("sanitizeNote", () => {
  it("fixes the {} competitor template bug", () => {
    expect(sanitizeNote("Customer comparing with {} competitor")).toBe(
      "Customer comparing with a competitor",
    );
  });
  it("neutralises any other stray {}", () => {
    expect(sanitizeNote("Quoted {} on-road")).toBe("Quoted … on-road");
  });
  it("leaves clean notes alone", () => {
    expect(sanitizeNote("Budget did not work out")).toBe("Budget did not work out");
  });
});

describe("status from history", () => {
  it("derives status from the last history entry, not the stored field", () => {
    const lead = rawLead("L1", [["new", "2025-12-01T00:00:00Z"], ["contacted", "2025-12-02T00:00:00Z"]], {
      status: "lost",
    });
    expect(deriveStatus(lead)).toBe("contacted");
  });

  it("records the first time each stage was reached", () => {
    const lead = rawLead("L1", [["new", "2025-12-01T00:00:00Z"], ["lost", "2025-12-03T00:00:00Z"]]);
    expect(stageTimestamps(lead)).toEqual({
      new: "2025-12-01T00:00:00Z",
      lost: "2025-12-03T00:00:00Z",
    });
  });
});

describe("lossNoteContradicts", () => {
  const lost = (note: string, reason: string) => {
    const l = rawLead("L1", [["new", "2025-12-01T00:00:00Z"], ["lost", "2025-12-03T00:00:00Z"]], {
      lost_reason: reason,
    });
    l.status_history[1].note = note;
    return l;
  };
  it("flags a competitor note paired with a non-competitor reason", () => {
    expect(lossNoteContradicts(lost("Customer went with Hyundai Creta", "Relocated to another city"))).toBe(true);
  });
  it("accepts a competitor note paired with a competitor reason", () => {
    expect(lossNoteContradicts(lost("Customer went with Kia Seltos", "Chose competitor brand"))).toBe(false);
  });
});

describe("buildDataset", () => {
  const ds = sampleDataset();
  const lead = (id: string) => ds.leads.find((l) => l.id === id)!;

  it("uses AS_OF from the data", () => {
    expect(ds.asOf).toBe(new Date(AS_OF).toISOString());
  });

  it("treats stored-lost leads without a lost event as open and flags them", () => {
    expect(lead("L6").status).toBe("contacted");
    expect(lead("L6").storedStatus).toBe("lost");
    expect(lead("L6").dataQualityIssue).toBe("status_lost_without_event");
    expect(lead("L6").lostReason).toBeNull();
    expect(ds.dataQuality.statusLostWithoutEvent).toEqual(["L6"]);
  });

  it("handles a lead that was never contacted", () => {
    const l5 = lead("L5");
    expect(l5.status).toBe("new");
    expect(l5.stageTimestamps.contacted).toBeUndefined();
    expect(l5.daysIdle).toBe(11);
    expect(l5.dataQualityIssue).toBeNull();
  });

  it("handles a lead lost at the first stage", () => {
    const l3 = lead("L3");
    expect(l3.status).toBe("lost");
    expect(l3.lostAt).toBe("2025-10-04T10:00:00Z");
    expect(l3.bookedAt).toBeNull();
    expect(l3.lostReason).toBe("Budget constraints");
  });

  it("derives booking, delivery and days in stage", () => {
    expect(lead("L1").bookedAt).toBe("2025-10-10T10:00:00Z");
    expect(lead("L1").delivery?.days_to_deliver).toBe(20);
    expect(lead("L2").delivery).toBeNull();
    expect(lead("L2").daysInStage).toBe(56);
    expect(lead("L4").daysInStage).toBe(30);
  });

  it("builds lookups with an entry for every branch and rep, even empty ones", () => {
    expect(ds.leadsByBranch.B1.map((l) => l.id)).toEqual(["L1", "L2", "L3", "L4", "L5", "L6"]);
    expect(ds.leadsByRep.M1).toEqual([]);
    expect(ds.months).toEqual(["2025-10", "2025-11"]);
  });

  it("sanitizes notes in history but counts the raw template bugs", () => {
    const raw = rawDataset({ leads: [rawLead("L1", [["new", "2025-12-01T00:00:00Z"]])] });
    raw.leads[0].status_history[0].note = "Customer comparing with {} competitor";
    const built = buildDataset(raw);
    expect(built.leads[0].history[0].note).toBe("Customer comparing with a competitor");
    expect(built.dataQuality.templatedNotes).toBe(1);
  });
});
