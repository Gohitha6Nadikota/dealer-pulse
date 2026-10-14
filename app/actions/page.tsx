import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionFilterBar } from "@/components/actions/action-filter-bar";
import { ActionTable } from "@/components/actions/action-table";
import { StatusConflictExplainer } from "@/components/actions/status-conflict-explainer";
import { EmptyState } from "@/components/dashboard/empty-state";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { SectionCard } from "@/components/dashboard/section-card";
import { FilterTransition, PendingRegion } from "@/components/filters/filter-transition";
import { actionsHref, parseActionParams } from "@/lib/action-params";
import { buildActionCenter, type ActionCenterView } from "@/lib/analytics/actions-view";
import { THRESHOLDS } from "@/lib/analytics/definitions";
import { getDataset } from "@/lib/data";
import { hrefWithFilters, parseFilters } from "@/lib/filters";
import { formatDate, formatDays, formatINR, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Action Center" };

const SEVERITY_HELP = `Act now: at least twice a threshold (idle ${THRESHOLDS.staleLeadDays * 2}+ days, negotiation ${THRESHOLDS.stalledNegotiationDays * 2}+ days, order waiting ${THRESHOLDS.stuckOrderDays * 2}+ days). Watch: past a threshold, or past the expected close date. Review: CRM status conflict only.`;

export default function ActionsPage({ searchParams }: PageProps<"/actions">) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Suspense fallback={<PageSkeleton label="Loading actions" />}>
        <ActionsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ActionsContent({ searchParams }: Pick<PageProps<"/actions">, "searchParams">) {
  const ds = getDataset();
  const params = await searchParams;
  const filters = parseFilters(params, { months: ds.months, branchIds: ds.branches.map((b) => b.id) });
  const view = buildActionCenter(ds, filters, parseActionParams(params, ds.reps.map((r) => r.id)));

  return (
    <FilterTransition>
      <PageHeader
        crumbs={[{ label: "Overview", href: hrefWithFilters("/", filters) }, { label: "Action Center" }]}
        title="Action Center"
        subtitle={`Snapshot as of ${formatDate(view.asOf)} (UTC). One row per lead, with every reason that applies; the date range doesn't apply here.`}
      >
        <ActionFilterBar
          filters={filters}
          params={view.params}
          branches={ds.branches.map((b) => ({ id: b.id, name: b.name }))}
          owners={view.owners}
          facets={view.facets}
        />
      </PageHeader>
      <PendingRegion className="flex flex-col gap-6">
        <ActionSections view={view} />
      </PendingRegion>
    </FilterTransition>
  );
}

function ActionSections({ view }: { view: ActionCenterView }) {
  const { summary, filters, params } = view;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Leads needing action"
          value={formatNumber(summary.total)}
          help="Each lead counts once, however many reasons apply."
          detail={summary.total === view.unfilteredTotal ? undefined : `of ${formatNumber(view.unfilteredTotal)} before filters`}
        />
        <KpiCard
          label="Act now"
          value={formatNumber(summary.bySeverity.critical)}
          help={SEVERITY_HELP}
          detail={`${formatNumber(summary.bySeverity.warning)} watch · ${formatNumber(summary.bySeverity.review)} review`}
        />
        <KpiCard
          label="Deal value involved"
          value={formatINR(summary.value)}
          help="Sum of deal value for these leads, each counted once. Delayed orders are already booked; this is value at risk of slipping, not lost."
        />
        <KpiCard
          label="Delayed deliveries"
          value={formatNumber(summary.byReason.delayed_order)}
          help={`Orders placed more than ${THRESHOLDS.stuckOrderDays} days ago and not delivered. Owned by the branch manager.`}
          detail={`${formatNumber(summary.byReason.status_conflict)} CRM status conflicts to fix`}
        />
      </div>

      {params.reason === "status_conflict" && (
        <StatusConflictExplainer summary={view.statusConflicts} filters={filters} params={params} />
      )}

      <SectionCard
        title="What to do"
        description="Most urgent first: severity, then deal value × days. Select a customer for the lead's timeline."
        help={SEVERITY_HELP}
        contentClassName="px-0"
      >
        {view.items.length ? (
          <ActionTable items={view.items} filters={filters} />
        ) : (
          <EmptyState
            title="Nothing needs action for this filter"
            description="Try another reason, severity or person."
            className="mx-4"
          />
        )}
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SectionCard title="By person" description="Items each person owns or is assigned. Select to filter.">
          {summary.byOwner.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {summary.byOwner.slice(0, 8).map((o) => (
                <li key={o.id} className="flex items-baseline justify-between gap-2">
                  <Link href={actionsHref(filters, { ...params, ownerId: o.id })} className="truncate hover:underline">
                    {o.name}
                    {o.role === "branch_manager" && <span className="text-muted-foreground"> (manager)</span>}
                  </Link>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {o.critical > 0 && <span className="font-medium text-critical-foreground">{o.critical} now · </span>}
                    {o.count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No one has open items.</p>
          )}
        </SectionCard>
        <SectionCard title="By branch" description="Select to filter.">
          {summary.byBranch.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {summary.byBranch.map((b) => (
                <li key={b.id} className="flex items-baseline justify-between gap-2">
                  <Link
                    href={actionsHref({ ...filters, branchId: b.id }, { ...params, ownerId: null })}
                    className="truncate hover:underline"
                  >
                    {b.name}
                  </Link>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {b.critical > 0 && <span className="font-medium text-critical-foreground">{b.critical} now · </span>}
                    {b.count} · {formatINR(b.value)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No branch has open items.</p>
          )}
        </SectionCard>
        <SectionCard
          title="Why deliveries ran late"
          description={`From ${formatNumber(view.delays.delivered)} delivered orders. Orders still waiting have no reason recorded yet.`}
        >
          {view.delays.reasons.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {view.delays.reasons.map((r) => (
                <li key={r.reason} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0">{r.reason}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {r.count} · avg {formatDays(r.avgDays, 0)}
                  </span>
                </li>
              ))}
              <li className="border-t pt-2 text-xs text-muted-foreground">
                With a reason: avg {formatDays(view.delays.avgDaysWithReason)}; without:{" "}
                {formatDays(view.delays.avgDaysWithoutReason)}.
              </li>
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No delays recorded.</p>
          )}
        </SectionCard>
      </div>
    </>
  );
}
