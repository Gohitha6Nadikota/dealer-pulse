/**
 * Month ranges. Months are "YYYY-MM" strings taken from UTC timestamps, so
 * string comparison is chronological comparison.
 */

/** Inclusive month range, e.g. { from: "2025-09", to: "2025-12" }. */
export type MonthRange = { from: string; to: string };

/** "YYYY-MM" of an ISO timestamp or date, in UTC as stored. */
export function monthOf(timestamp: string): string {
  return timestamp.slice(0, 7);
}

export function inRange(month: string, range: MonthRange): boolean {
  return month >= range.from && month <= range.to;
}

/** True when the timestamp is non-null and falls inside the range. */
export function timestampInRange(timestamp: string | null, range: MonthRange): boolean {
  return timestamp !== null && inRange(monthOf(timestamp), range);
}

/** Every month from `from` to `to` inclusive. Empty if from > to. */
export function monthsInRange(range: MonthRange): string[] {
  const out: string[] = [];
  let [y, m] = range.from.split("-").map(Number);
  const [endY, endM] = range.to.split("-").map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** The month before `month`. */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
