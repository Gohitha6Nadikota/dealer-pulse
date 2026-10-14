import { describe, expect, it } from "vitest";
import { sampleDataset } from "@/lib/analytics/fixtures";
import { createdIn, funnel, stageWhenLost } from "@/lib/analytics/funnel";

const ds = sampleDataset();
const lead = (id: string) => ds.leads.find((l) => l.id === id)!;

describe("funnel", () => {
  const f = funnel(ds.leads);

  it("counts reach per stage from history", () => {
    expect(f.total).toBe(8);
    expect(f.stages.map((s) => s.reached)).toEqual([8, 6, 4, 3, 2, 1]);
  });

  it("computes stage-to-stage conversion", () => {
    expect(f.stages[0].conversion).toBeNull();
    expect(f.stages[1].conversion).toBe(6 / 8);
    expect(f.stages[4].conversion).toBe(2 / 3);
  });

  it("locates where lost leads dropped out", () => {
    expect(stageWhenLost(lead("L3"))).toBe("new");
    expect(stageWhenLost(lead("L7"))).toBe("test_drive");
    expect(stageWhenLost(lead("L6"))).toBeNull(); // flagged, not actually lost
    expect(f.stages.find((s) => s.stage === "new")?.lostHere).toBe(1);
    expect(f.stages.find((s) => s.stage === "test_drive")?.lostHere).toBe(1);
  });

  it("breaks down loss reasons from the structured field", () => {
    expect(f.lost).toBe(2);
    expect(f.lossReasons).toEqual([
      { reason: "Budget constraints", count: 1, share: 0.5 },
      { reason: "Chose competitor brand", count: 1, share: 0.5 },
    ]);
  });

  it("handles an empty cohort without NaN", () => {
    const empty = funnel([]);
    expect(empty.total).toBe(0);
    expect(empty.stages.every((s) => s.reached === 0 && s.conversion === null)).toBe(true);
    expect(empty.lossReasons).toEqual([]);
  });

  it("filters the cohort by creation month", () => {
    expect(createdIn(ds.leads, { from: "2025-12", to: "2025-12" }).map((l) => l.id)).toEqual(["L5", "L6", "L8"]);
  });
});
