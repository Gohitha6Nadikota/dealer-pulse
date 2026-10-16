/**
 * Lead sources and car models for a cohort of leads (usually: created in the
 * selected range, within a scope). Outcomes follow the usual conventions:
 *
 *   won    = reached order_placed (status from history)
 *   lost   = a genuine loss event; leads stored as "lost" without one are open
 *   win rate = won ÷ (won + lost); still-open leads are left out
 */
import { createdIn } from "@/lib/analytics/funnel";
import { ratio, sumBy } from "@/lib/analytics/kpis";
import type { MonthRange } from "@/lib/analytics/range";
import { humanize } from "@/lib/format";
import type { Dataset, Lead } from "@/lib/types";

/** Fewer leads than this in a segment: shown, but flagged as a small sample. */
export const MIN_SEGMENT_SAMPLE = 20;
/** Source win rates within this many points of each other are treated as "no difference". */
export const SOURCE_SPREAD_POINTS = 5;

export type SegmentRow = {
  key: string;
  label: string;
  /** Leads in the cohort. */
  leads: number;
  won: number;
  lost: number;
  /** Neither won nor genuinely lost yet. */
  open: number;
  winRate: number | null;
  /** INR, deal value of won leads. */
  bookedRevenue: number;
  /** This segment's share of the cohort's booked revenue. */
  revenueShare: number | null;
  /** Share of the cohort's leads. */
  leadShare: number | null;
  /** Fewer than MIN_SEGMENT_SAMPLE leads. */
  small: boolean;
};

function segment(leads: Lead[], key: (l: Lead) => string, label: (k: string) => string): SegmentRow[] {
  const groups = new Map<string, Lead[]>();
  for (const lead of leads) {
    const k = key(lead);
    groups.set(k, [...(groups.get(k) ?? []), lead]);
  }
  const totalRevenue = sumBy(leads.filter((l) => l.bookedAt !== null), (l) => l.dealValue);
  return [...groups].map(([k, group]) => {
    const won = group.filter((l) => l.bookedAt !== null);
    const lost = group.filter((l) => l.bookedAt === null && l.lostAt !== null).length;
    const bookedRevenue = sumBy(won, (l) => l.dealValue);
    return {
      key: k,
      label: label(k),
      leads: group.length,
      won: won.length,
      lost,
      open: group.length - won.length - lost,
      winRate: ratio(won.length, won.length + lost),
      bookedRevenue,
      revenueShare: ratio(bookedRevenue, totalRevenue),
      leadShare: ratio(group.length, leads.length),
      small: group.length < MIN_SEGMENT_SAMPLE,
    };
  });
}

/** One row per lead source, most leads first. Empty for no leads. */
export function sourceMix(leads: Lead[]): SegmentRow[] {
  return segment(leads, (l) => l.source, humanize).sort(
    (a, b) => b.leads - a.leads || a.label.localeCompare(b.label),
  );
}

/** One row per car model, highest booked revenue first. Empty for no leads. */
export function modelMix(leads: Lead[]): SegmentRow[] {
  return segment(leads, (l) => l.model, (k) => k).sort(
    (a, b) => b.bookedRevenue - a.bookedRevenue || b.leads - a.leads || a.label.localeCompare(b.label),
  );
}

/**
 * Spread, in percentage points, between the highest and lowest win rate among
 * sources with enough leads to judge. null when fewer than two qualify.
 */
export function sourceWinRateSpread(rows: SegmentRow[]): number | null {
  const rates = rows.filter((r) => !r.small && r.winRate !== null).map((r) => r.winRate!);
  if (rates.length < 2) return null;
  return Math.round((Math.max(...rates) - Math.min(...rates)) * 100);
}

/** First-note wording that implies a channel, as written in this dataset. */
export const NOTE_SOURCE_PATTERNS: [RegExp, string][] = [
  [/^Walk-in enquiry/i, "walk_in"],
  [/^DM on Instagram/i, "social_media"],
  [/^Website form submission/i, "website"],
  [/^Called about .* pricing/i, "phone_enquiry"],
  [/^Phone call enquiry/i, "phone_enquiry"],
  [/^Enquired at auto expo/i, "auto_expo"],
  [/^Referred by existing customer/i, "referral"],
];

/** The channel the first note implies, or null if it doesn't name one. */
export function noteSource(note: string): string | null {
  return NOTE_SOURCE_PATTERNS.find(([re]) => re.test(note))?.[1] ?? null;
}

export type SourceNoteAgreement = {
  /** Leads whose first note names a channel. */
  compared: number;
  /** Of those, how many match the `source` field. */
  agree: number;
  share: number | null;
  /** The agreement expected if source and note were unrelated (same mix of each). */
  expectedIfUnrelated: number | null;
};

/** How often `source` matches the channel named in the lead's first history note. */
export function sourceNoteAgreement(leads: Lead[]): SourceNoteAgreement {
  const pairs = leads.flatMap((l) => {
    const implied = noteSource(l.history[0]?.note ?? "");
    return implied ? [{ source: l.source, implied }] : [];
  });
  const n = pairs.length;
  const agree = pairs.filter((p) => p.source === p.implied).length;
  let expected = 0;
  for (const s of new Set(pairs.map((p) => p.source))) {
    expected += (pairs.filter((p) => p.source === s).length / n) * (pairs.filter((p) => p.implied === s).length / n);
  }
  return { compared: n, agree, share: ratio(agree, n), expectedIfUnrelated: n ? expected : null };
}

export type Segments = {
  sources: SegmentRow[];
  models: SegmentRow[];
  /** Highest minus lowest source win rate, in points (judgeable sources only). */
  sourceSpreadPoints: number | null;
  /** True when that spread is within SOURCE_SPREAD_POINTS: source doesn't separate conversion. */
  sourcesLookAlike: boolean;
  agreement: SourceNoteAgreement;
  /**
   * Stable colour slot per source, from every source in the dataset (alphabetical),
   * so a filtered view never repaints a source.
   */
  sourceColorIndex: Record<string, number>;
};

/** Both cards' data for a cohort of leads. `allSources` fixes the colour order. */
export function segments(leads: Lead[], allSources: string[] = []): Segments {
  const sources = sourceMix(leads);
  const spread = sourceWinRateSpread(sources);
  const order = [...new Set([...allSources, ...sources.map((s) => s.key)])].sort();
  return {
    sources,
    models: modelMix(leads),
    sourceSpreadPoints: spread,
    sourcesLookAlike: spread !== null && spread <= SOURCE_SPREAD_POINTS,
    agreement: sourceNoteAgreement(leads),
    sourceColorIndex: Object.fromEntries(order.map((k, i) => [k, i])),
  };
}

/**
 * The cards' data for a scope: leads created in `range`, for one branch or
 * (branchId null) every branch. Reusable from any page.
 */
export function buildSegments(ds: Dataset, range: MonthRange, branchId: string | null): Segments {
  const scope = branchId ? (ds.leadsByBranch[branchId] ?? []) : ds.leads;
  return segments(createdIn(scope, range), ds.leads.map((l) => l.source));
}
