import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { dataNotes } from "@/lib/analytics/data-notes";
import { buildDataset } from "@/lib/analytics/enrich";
import { HEALTH_BASIS } from "@/lib/analytics/health";
import { parseDataset } from "@/lib/analytics/validate";
import { METRIC_HELP } from "@/lib/metric-help";

describe("metric help", () => {
  it("explains why win rate and the funnel can differ", () => {
    expect(METRIC_HELP.winRate).toContain(
      "Counts deals won/lost during the period. The funnel counts leads created in the period, so the two can differ.",
    );
  });

  it("states what health is based on, and that it ignores targets", () => {
    for (const text of [HEALTH_BASIS, METRIC_HELP.health]) {
      expect(text).toMatch(/win rate vs the company average/);
      expect(text).toMatch(/bookings vs the branch's own previous period/);
      expect(text).toMatch(/delivery time vs the company average/);
      expect(text).toMatch(/does not use target attainment/);
    }
    expect(METRIC_HELP.health).toContain("Data notes");
  });

  it("doesn't hard-code a target multiple", () => {
    expect(METRIC_HELP.attainment).not.toMatch(/\d+×/);
  });
});

describe("data notes", () => {
  it("explains the likely stale records with numbers from the data", () => {
    const real = buildDataset(parseDataset(rawJson as unknown));
    const note = dataNotes(real).find((n) => n.title.includes("stale records"));
    expect(note?.title).toBe("11 orders look like stale records");
    expect(note?.detail).toContain("90+ days (up to 195)");
    expect(note?.detail).toContain("slowest recorded delivery took 39 days");
  });
});
