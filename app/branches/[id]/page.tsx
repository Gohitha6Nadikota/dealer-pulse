import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DataNotesLink } from "@/components/app-shell/data-notes-link";
import { AttentionCard } from "@/components/dashboard/attention-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { HealthBadgeWithReasons } from "@/components/dashboard/health-badge";
import { InsightBanner } from "@/components/dashboard/insight-banner";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { RepTable } from "@/components/dashboard/rep-table";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusConflictNotice } from "@/components/dashboard/status-conflict-notice";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { FilterBar } from "@/components/filters/filter-bar";
import { FilterTransition, PendingRegion } from "@/components/filters/filter-transition";
import { LeadTable } from "@/components/leads/lead-table";
import { actionsHref } from "@/lib/action-params";
import { buildBranchView } from "@/lib/analytics/branch-view";
import { statusConflictNotice } from "@/lib/analytics/status-conflicts";
import { getBranch, getDataset } from "@/lib/data";
import { hrefWithFilters, parseRangeFilters } from "@/lib/filters";
import { formatDate, formatNumber, formatRange } from "@/lib/format";
import { METRIC_HELP } from "@/lib/metric-help";

/**
 * Every branch is prerendered. Unknown ids get a real 404 from proxy.ts before
 * rendering; the notFound() inside the content is a second line of defence.
 */
export function generateStaticParams() {
  return getDataset().branches.map((b) => ({ id: b.id }));
}

export async function generateMetadata({ params }: PageProps<"/branches/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getBranch(id)?.name ?? "Branch not found" };
}

// The shell is shared by every branch URL, so params are read inside Suspense:
// a client navigation can show the skeleton at once instead of waiting on the server.
export default function BranchPage({ params, searchParams }: PageProps<"/branches/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Suspense fallback={<PageSkeleton label="Loading branch" />}>
        <BranchContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BranchContent({ params, searchParams }: PageProps<"/branches/[id]">) {
  const { id } = await params;
  const ds = getDataset();
  const filters = parseRangeFilters(await searchParams, {
    months: ds.months,
    branchIds: ds.branches.map((b) => b.id),
  });
  const view = buildBranchView(ds, id, filters);
  if (!view) notFound();
  const { branch, manager, asOf } = view;

  return (
    <FilterTransition>
      <PageHeader
        crumbs={[
          { label: "Overview", href: hrefWithFilters("/", filters) },
          { label: "Branches", href: hrefWithFilters("/branches", filters) },
          { label: branch.name },
        ]}
        title={branch.name}
        badge={
          <>
            <HealthBadgeWithReasons health={view.health} />
            <span className="text-xs text-muted-foreground">
              Health ignores targets (<DataNotesLink>why</DataNotesLink>)
            </span>
          </>
        }
        subtitle={
          <>
            {branch.city}
            {manager && <> · Manager {manager.name}</>} · {formatNumber(view.reps.length)} sales officers ·{" "}
            {formatRange(filters.range)}
          </>
        }
      >
        <FilterBar path={`/branches/${branch.id}`} filters={filters} months={ds.months} />
      </PageHeader>

      <PendingRegion className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <InsightBanner insight={view.insight} />
          <StatusConflictNotice
            notice={statusConflictNotice(view.statusConflicts, branch.name)}
            href={actionsHref({ ...filters, branchId: branch.id }, { reason: "status_conflict" })}
          />
        </div>
        <KpiStrip summary={view} asOf={asOf} pipelineConflicts={view.statusConflicts.count} />

        <div className="grid gap-4 xl:grid-cols-5">
          <SectionCard
            title="Monthly bookings vs branch target"
            description="Attainment = units booked ÷ target units, by order month. The axis follows bookings; targets far above it are labelled, not drawn. Selected range highlighted."
            help={METRIC_HELP.attainment}
            className="xl:col-span-3"
          >
            <TrendChart data={view.trend} />
          </SectionCard>
          <SectionCard
            title="Funnel vs company"
            description={`${formatNumber(view.funnel.total)} leads created in ${formatRange(filters.range)}`}
            help={METRIC_HELP.funnel}
            className="xl:col-span-2"
          >
            {view.funnel.total ? (
              <FunnelChart
                funnel={view.funnel}
                drop={view.funnelDrop}
                comparison={{ stages: view.funnelVsCompany, label: "company" }}
                conflicts={view.funnelConflicts}
              />
            ) : (
              <EmptyState title="No new leads in this period" className="py-8" />
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="Sales officers"
          description={`Bookings and win rate in ${formatRange(filters.range)}; open and idle leads as of ${formatDate(asOf)} (UTC). Select an officer for their leads.`}
          contentClassName="px-0"
        >
          {view.reps.length ? (
            <RepTable rows={view.reps} filters={filters} />
          ) : (
            <EmptyState title="No sales officers in this branch" className="mx-4" />
          )}
        </SectionCard>

        <AttentionCard attention={view.attention} asOf={asOf} href={actionsHref({ ...filters, branchId: branch.id })} />

        <SectionCard
          title="Open leads and orders"
          description={`As of ${formatDate(asOf)} (UTC), not affected by the date filter. Select a lead for its timeline.`}
          contentClassName="px-0"
        >
          <LeadTable rows={view.openLeads} buckets={["open", "awaiting", "all"]} defaultBucket="open" showRep />
        </SectionCard>
      </PendingRegion>
    </FilterTransition>
  );
}
