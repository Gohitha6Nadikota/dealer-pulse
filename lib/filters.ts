/**
 * Global filters, stored in URL search params so every view is shareable and
 * drill-down links keep the filter. Parsing is forgiving: anything invalid
 * falls back to a default rather than erroring.
 *
 *   ?range=6m                  preset (3m | 6m | all); 3m is the default
 *   ?from=2025-09&to=2025-11   custom range (wins over range=)
 *   ?branch=B2                 branch scope
 */
import type { MonthRange } from "@/lib/analytics/range";

export const RANGE_PRESETS = [
  { id: "3m", label: "Last 3 months", months: 3 },
  { id: "6m", label: "Last 6 months", months: 6 },
  { id: "all", label: "All time", months: null },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]["id"] | "custom";
export const DEFAULT_PRESET: RangePreset = "3m";

export type Filters = {
  preset: RangePreset;
  range: MonthRange;
  branchId: string | null;
};

export type SearchParams = Record<string, string | string[] | undefined>;

export type FilterContext = {
  /** Months that have data, ascending (YYYY-MM). */
  months: string[];
  branchIds: string[];
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Range for a preset, anchored on the latest month with data (the AS_OF month). */
export function presetRange(preset: Exclude<RangePreset, "custom">, months: string[]): MonthRange {
  const def = RANGE_PRESETS.find((p) => p.id === preset)!;
  const last = months.length - 1;
  const start = def.months === null ? 0 : Math.max(0, last - def.months + 1);
  return { from: months[start], to: months[last] };
}

export function parseFilters(params: SearchParams, ctx: FilterContext): Filters {
  const branch = first(params.branch);
  const branchId = branch && ctx.branchIds.includes(branch) ? branch : null;

  const from = first(params.from);
  const to = first(params.to);
  if (from && to && ctx.months.includes(from) && ctx.months.includes(to)) {
    const range = from <= to ? { from, to } : { from: to, to: from };
    return { preset: "custom", range, branchId };
  }

  const requested = first(params.range);
  const preset = RANGE_PRESETS.find((p) => p.id === requested)?.id ?? DEFAULT_PRESET;
  return { preset, range: presetRange(preset as Exclude<RangePreset, "custom">, ctx.months), branchId };
}

/** Query string for the filters ("" when everything is default). */
export function filtersToQuery(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.preset === "custom") {
    params.set("from", filters.range.from);
    params.set("to", filters.range.to);
  } else if (filters.preset !== DEFAULT_PRESET) {
    params.set("range", filters.preset);
  }
  if (filters.branchId) params.set("branch", filters.branchId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** `path` with the filters applied, for links that should keep the current view. */
export function hrefWithFilters(path: string, filters: Filters, changes: Partial<Filters> = {}): string {
  return `${path}${filtersToQuery({ ...filters, ...changes })}`;
}

/**
 * The equal-length period immediately before `range`, or null when it isn't
 * fully covered by the data (a partial comparison would mislead).
 */
export function previousPeriod(range: MonthRange, months: string[]): MonthRange | null {
  const start = months.indexOf(range.from);
  const end = months.indexOf(range.to);
  if (start < 0 || end < 0) return null;
  const length = end - start + 1;
  if (start - length < 0) return null;
  return { from: months[start - length], to: months[start - 1] };
}

/**
 * Filters for a page whose scope is already in the path (/branches/B2,
 * /reps/SR3): only the date range applies, so any ?branch= is dropped.
 */
export function parseRangeFilters(params: SearchParams, ctx: FilterContext): Filters {
  return { ...parseFilters(params, ctx), branchId: null };
}

/** Query params that carry the date range only (for nav links between scopes). */
export const RANGE_PARAMS = ["range", "from", "to"] as const;

/** Keep only the date-range params from a query string: "?range=6m&branch=B2" → "?range=6m". */
export function rangeQuery(search: string): string {
  const source = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of RANGE_PARAMS) {
    const value = source.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `?${query}` : "";
}
