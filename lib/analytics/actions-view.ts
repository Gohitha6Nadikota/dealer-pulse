/** View model for /actions. Items are a snapshot as of AS_OF; the date range doesn't apply. */
import {
  ACTION_REASONS,
  SEVERITIES,
  type ActionParams,
  type ActionReason,
  type Severity,
} from "@/lib/action-params";
import {
  actionItems,
  filterActions,
  summarizeActions,
  type ActionFilters,
  type ActionItem,
  type ActionSummary,
} from "@/lib/analytics/action-center";
import { delayReasons, type DelaySummary } from "@/lib/analytics/actions";
import type { Filters } from "@/lib/filters";
import type { Dataset } from "@/lib/types";

export type ActionCenterView = {
  asOf: string;
  filters: Filters;
  params: ActionParams;
  /** Items matching every filter, most urgent first. */
  items: ActionItem[];
  /** Summary of `items`. */
  summary: ActionSummary;
  /** Count for each option if chosen, with the other filters applied. */
  facets: {
    reason: Record<ActionReason, number>;
    severity: Record<Severity, number>;
  };
  /** People who own or are assigned at least one item (within the branch filter). */
  owners: { id: string; name: string; role: ActionItem["owner"]["role"] }[];
  /** Delay reasons recorded on delivered orders (history; undelivered orders have none). */
  delays: DelaySummary;
  /** Total items before reason/severity/owner filters (branch applied). */
  unfilteredTotal: number;
};

export function buildActionCenter(ds: Dataset, filters: Filters, params: ActionParams): ActionCenterView {
  const scopeLeads = filters.branchId ? ds.leadsByBranch[filters.branchId] ?? [] : ds.leads;
  const all = actionItems(ds, scopeLeads);
  const f: ActionFilters = { ...params, branchId: filters.branchId };
  const items = filterActions(all, f);

  const facet = <K extends string>(keys: readonly K[], apply: (k: K) => ActionFilters) =>
    Object.fromEntries(keys.map((k) => [k, filterActions(all, apply(k)).length])) as Record<K, number>;

  const ownerMap = new Map<string, ActionCenterView["owners"][number]>();
  for (const item of all) {
    ownerMap.set(item.owner.id, item.owner);
    ownerMap.set(item.rep.id, item.rep);
  }

  return {
    asOf: ds.asOf,
    filters,
    params,
    items,
    summary: summarizeActions(items),
    facets: {
      reason: facet(ACTION_REASONS, (reason) => ({ ...f, reason })),
      severity: facet(SEVERITIES, (severity) => ({ ...f, severity })),
    },
    owners: [...ownerMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    delays: delayReasons(scopeLeads),
    unfilteredTotal: all.length,
  };
}
