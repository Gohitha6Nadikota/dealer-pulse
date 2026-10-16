import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { buildDataset } from "@/lib/analytics/enrich";
import { rawDataset, rawLead } from "@/lib/analytics/fixtures";
import { createdIn } from "@/lib/analytics/funnel";
import { buildFunnelView } from "@/lib/analytics/funnel-view";
import {
  MIN_SEGMENT_SAMPLE,
  modelMix,
  noteSource,
  segments,
  sourceMix,
  sourceNoteAgreement,
  sourceWinRateSpread,
} from "@/lib/analytics/segments";
import { parseDataset } from "@/lib/analytics/validate";
import { parseFilters } from "@/lib/filters";
import type { LeadStatus } from "@/lib/types";

const T = (d: number) => `2025-11-${String(d).padStart(2, "0")}T10:00:00Z`;
const WON: [LeadStatus, string][] = [["new", T(1)], ["contacted", T(2)], ["order_placed", T(5)]];
const LOST: [LeadStatus, string][] = [["new", T(1)], ["lost", T(3)]];
const OPEN: [LeadStatus, string][] = [["new", T(1)], ["contacted", T(2)]];

const ds = buildDataset(
  rawDataset({
    leads: [
      rawLead("W1", WON, { source: "walk_in", model_interested: "Fortuner", deal_value: 4_000_000 }),
      rawLead("W2", WON, { source: "walk_in", model_interested: "Glanza", deal_value: 1_000_000 }),
      rawLead("W3", LOST, { source: "walk_in", model_interested: "Glanza" }),
      // social_media: no wins at all
      rawLead("S1", LOST, { source: "social_media", model_interested: "Glanza" }),
      rawLead("S2", LOST, { source: "social_media", model_interested: "Camry" }),
      // website: only open leads, one stored as lost without a loss event
      rawLead("X1", OPEN, { source: "website", model_interested: "Camry" }),
      rawLead("X2", OPEN, { source: "website", model_interested: "Camry", status: "lost", lost_reason: null }),
    ],
  }),
);
const row = (rows: ReturnType<typeof sourceMix>, key: string) => rows.find((r) => r.key === key)!;

describe("sourceMix", () => {
  const rows = sourceMix(ds.leads);

  it("counts leads, wins, genuine losses and open leads per source, most leads first", () => {
    expect(rows.map((r) => r.key)).toEqual(["walk_in", "social_media", "website"]);
    expect(row(rows, "walk_in")).toMatchObject({ label: "Walk in", leads: 3, won: 2, lost: 1, open: 0 });
    expect(row(rows, "walk_in").winRate).toBeCloseTo(2 / 3);
  });

  it("gives a source with no wins a 0% win rate, not a missing one", () => {
    expect(row(rows, "social_media")).toMatchObject({ won: 0, lost: 2, winRate: 0, bookedRevenue: 0, revenueShare: 0 });
  });

  it("treats stored-as-lost leads as open, and has no win rate without outcomes", () => {
    expect(row(rows, "website")).toMatchObject({ leads: 2, won: 0, lost: 0, open: 2, winRate: null });
  });

  it("flags every source under the sample threshold", () => {
    expect(MIN_SEGMENT_SAMPLE).toBe(20);
    expect(rows.every((r) => r.small)).toBe(true);
  });

  it("shares add up to 1", () => {
    expect(rows.reduce((n, r) => n + (r.leadShare ?? 0), 0)).toBeCloseTo(1);
    expect(rows.reduce((n, r) => n + (r.revenueShare ?? 0), 0)).toBeCloseTo(1);
  });

  it("returns nothing for a month with zero leads", () => {
    const december = createdIn(ds.leads, { from: "2025-12", to: "2025-12" });
    expect(december).toEqual([]);
    expect(sourceMix(december)).toEqual([]);
    expect(modelMix(december)).toEqual([]);
    expect(segments(december)).toMatchObject({ sources: [], models: [], sourceSpreadPoints: null, sourcesLookAlike: false });
    expect(segments(december).agreement).toEqual({ compared: 0, agree: 0, share: null, expectedIfUnrelated: null });
  });

  it("keeps each source's colour slot whatever the filter", () => {
    const all = segments(ds.leads, ds.leads.map((l) => l.source));
    const onlySocial = segments(ds.leads.filter((l) => l.source === "social_media"), ds.leads.map((l) => l.source));
    expect(all.sourceColorIndex).toEqual({ social_media: 0, walk_in: 1, website: 2 });
    expect(onlySocial.sourceColorIndex.social_media).toBe(all.sourceColorIndex.social_media);
  });
});

describe("modelMix", () => {
  const rows = modelMix(ds.leads);

  it("sorts by booked revenue and computes the revenue share", () => {
    expect(rows.map((r) => r.key)).toEqual(["Fortuner", "Glanza", "Camry"]);
    expect(rows[0]).toMatchObject({ leads: 1, won: 1, bookedRevenue: 4_000_000, revenueShare: 0.8 });
    expect(rows[1]).toMatchObject({ leads: 3, won: 1, lost: 2, bookedRevenue: 1_000_000, revenueShare: 0.2 });
    expect(rows[1].winRate).toBeCloseTo(1 / 3);
    expect(rows[2]).toMatchObject({ leads: 3, won: 0, lost: 1, open: 2, winRate: 0, revenueShare: 0 });
  });
});

describe("sourceWinRateSpread", () => {
  it("ignores small samples and needs two judgeable sources", () => {
    expect(sourceWinRateSpread(sourceMix(ds.leads))).toBeNull();
  });
});

describe("source vs first note", () => {
  it("maps first-note wording to a channel", () => {
    expect(noteSource("Walk-in enquiry about Glanza")).toBe("walk_in");
    expect(noteSource("Called about Camry pricing")).toBe("phone_enquiry");
    expect(noteSource("DM on Instagram about Fortuner")).toBe("social_media");
    expect(noteSource("Final pricing discussion")).toBeNull();
  });

  it("measures agreement and what chance alone would give", () => {
    const leads = buildDataset(
      rawDataset({
        leads: [
          rawLead("A", [["new", T(1)]], { source: "walk_in" }),
          rawLead("B", [["new", T(1)]], { source: "website" }),
        ],
      }),
    ).leads;
    leads[0].history[0].note = "Walk-in enquiry about Glanza"; // agrees
    leads[1].history[0].note = "Walk-in enquiry about Camry"; // disagrees
    expect(sourceNoteAgreement(leads)).toEqual({ compared: 2, agree: 1, share: 0.5, expectedIfUnrelated: 0.5 });
  });
});

describe("real data", () => {
  const real = buildDataset(parseDataset(rawJson as unknown));
  const ctx = { months: real.months, branchIds: real.branches.map((b) => b.id) };
  const all = buildFunnelView(real, parseFilters({ range: "all" }, ctx)).segments;

  it("finds source win rates far apart, so the 'no difference' line stays off", () => {
    const walkIn = all.sources.find((r) => r.key === "walk_in")!;
    const social = all.sources.find((r) => r.key === "social_media")!;
    expect(walkIn).toMatchObject({ leads: 140, won: 83, lost: 50 });
    expect(social).toMatchObject({ leads: 72, won: 12, lost: 52 });
    expect(all.sourceSpreadPoints).toBe(44);
    expect(all.sourcesLookAlike).toBe(false);
  });

  it("shows the source field and first note agree no more than chance", () => {
    expect(all.agreement.compared).toBe(510);
    expect(all.agreement.agree).toBe(82);
    expect(all.agreement.expectedIfUnrelated).toBeCloseTo(0.169, 2);
  });

  it("ranks Fortuner first by revenue and flags Hilux as a small sample", () => {
    expect(all.models[0]).toMatchObject({ key: "Fortuner", leads: 94, won: 36 });
    expect(all.models.find((r) => r.key === "Hilux")).toMatchObject({ leads: 11, small: true });
    expect(all.models.reduce((n, r) => n + r.leads, 0)).toBe(510);
  });

  it("follows the range and branch filters", () => {
    const lakeside = buildFunnelView(real, parseFilters({ range: "all", branch: "B3" }, ctx)).segments;
    expect(lakeside.sources.reduce((n, r) => n + r.leads, 0)).toBe(79);
    const q4 = buildFunnelView(real, parseFilters({}, ctx)).segments;
    expect(q4.sources.reduce((n, r) => n + r.leads, 0)).toBe(260);
  });
});
