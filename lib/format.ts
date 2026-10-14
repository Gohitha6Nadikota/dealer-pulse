/**
 * Display formatting. Indian conventions: lakh (1,00,000) and crore
 * (1,00,00,000), en-IN digit grouping. Dates render in UTC to match how the
 * data's months are bucketed (see lib/analytics/range.ts).
 */
import type { MonthRange } from "@/lib/analytics/range";

const LAKH = 1e5;
const CRORE = 1e7;
export const EMPTY = "—";

const grouped = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function trim(n: number, digits: number): string {
  return n.toFixed(digits).replace(/\.0+$/, "");
}

/** Compact INR: ₹8.4 Cr, ₹20.9 L, ₹85,000. */
export function formatINR(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return EMPTY;
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= CRORE) return `${sign}₹${trim(abs / CRORE, abs >= 100 * CRORE ? 0 : 1)} Cr`;
  if (abs >= LAKH) return `${sign}₹${trim(abs / LAKH, 1)} L`;
  return `${sign}₹${grouped.format(abs)}`;
}

/** Full INR with Indian grouping: ₹22,97,000. */
export function formatINRFull(value: number): string {
  return `₹${grouped.format(value)}`;
}

export function formatNumber(value: number | null): string {
  return value === null ? EMPTY : grouped.format(value);
}

/** Ratio → percent: 0.138 → "14%". */
export function formatPercent(ratio: number | null, digits = 0): string {
  if (ratio === null || !Number.isFinite(ratio)) return EMPTY;
  return `${trim(ratio * 100, digits)}%`;
}

/** Signed change: 0.59 → "+59%", -0.12 → "−12%". */
export function formatChange(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return EMPTY;
  const pct = Math.round(ratio * 100);
  if (pct === 0) return "0%";
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

export function formatDays(days: number | null, digits = 1): string {
  if (days === null || !Number.isFinite(days)) return EMPTY;
  const text = trim(days, digits);
  return `${text} ${text === "1" ? "day" : "days"}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-10" → "Oct". */
export function formatMonthShort(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
}

/** "2025-10" → "Oct 2025". */
export function formatMonth(month: string): string {
  return `${formatMonthShort(month)} ${month.slice(0, 4)}`;
}

/** { from: "2025-10", to: "2025-12" } → "Oct – Dec 2025". */
export function formatRange(range: MonthRange): string {
  if (range.from === range.to) return formatMonth(range.from);
  if (range.from.slice(0, 4) === range.to.slice(0, 4)) {
    return `${formatMonthShort(range.from)} – ${formatMonth(range.to)}`;
  }
  return `${formatMonth(range.from)} – ${formatMonth(range.to)}`;
}

/** Range without the year when it's within one year: "Jul – Sep". For tight spaces. */
export function formatRangeCompact(range: MonthRange): string {
  if (range.from.slice(0, 4) !== range.to.slice(0, 4)) return formatRange(range);
  return range.from === range.to
    ? formatMonthShort(range.from)
    : `${formatMonthShort(range.from)} – ${formatMonthShort(range.to)}`;
}

/** ISO timestamp or date → "31 Dec 2025" (UTC, same month names as the rest of the app). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "test_drive" → "Test drive", "walk_in" → "Walk in". */
export function humanize(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
