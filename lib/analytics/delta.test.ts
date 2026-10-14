import { describe, expect, it } from "vitest";
import { pointsDelta, relativeDelta } from "@/lib/analytics/delta";

describe("relativeDelta", () => {
  it("marks increases good when higher is better", () => {
    expect(relativeDelta(118, 74)).toEqual({ label: "+59%", direction: "up", sentiment: "good" });
  });
  it("marks increases bad when lower is better (delivery days)", () => {
    expect(relativeDelta(21.4, 14.4, { higherIsBetter: false })).toMatchObject({ direction: "up", sentiment: "bad" });
    expect(relativeDelta(10, 20, { higherIsBetter: false })).toMatchObject({ direction: "down", sentiment: "good" });
  });
  it("treats tiny moves as flat", () => {
    expect(relativeDelta(1000, 1005)).toMatchObject({ direction: "flat", sentiment: "neutral" });
  });
  it("returns null without a usable comparison", () => {
    expect(relativeDelta(5, 0)).toBeNull();
    expect(relativeDelta(null, 5)).toBeNull();
    expect(relativeDelta(5, null)).toBeNull();
  });
});

describe("pointsDelta", () => {
  it("reports percentage points", () => {
    expect(pointsDelta(0.46, 0.41)).toEqual({ label: "+5 pts", direction: "up", sentiment: "good" });
    expect(pointsDelta(0.4, 0.43)).toEqual({ label: "−3 pts", direction: "down", sentiment: "bad" });
    expect(pointsDelta(0.42, 0.424)).toMatchObject({ label: "0 pts", direction: "flat" });
    expect(pointsDelta(null, 0.4)).toBeNull();
  });
});
