import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SectionCard } from "@/components/dashboard/section-card";
import { FilterBar } from "@/components/filters/filter-bar";
import { FilterTransition, PendingRegion } from "@/components/filters/filter-transition";
import { AttentionCard } from "@/components/overview/attention-card";
import { BranchTable } from "@/components/overview/branch-table";
import { FunnelChart } from "@/components/overview/funnel-card";
import { InsightBanner } from "@/components/overview/insight-banner";
import { KpiCard, KpiGroup } from "@/components/overview/kpi-card";
import { OverviewSkeleton } from "@/components/overview/overview-skeleton";
import { RepTable } from "@/components/overview/rep-table";
import { TrendChart } from "@/components/overview/trend-chart";
import { Button } from "@/components/ui/button";
import { buildOverview, type Overview } from "@/lib/analytics/overview";
import { getDataset } from "@/lib/data";
import { hrefWithFilters, parseFilters } from "@/lib/filters";
import { formatDate, formatDays, formatINR, formatNumber, formatPercent, formatRange, formatRangeCompact } from "@/lib/format";
import { METRIC_HELP } from "@/lib/metric-help";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage({ searchParams }: PageProps<"/">) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OverviewContent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const ds = getDataset();
  const filters = parseFilters(await searchParams, {
    months: ds.months,
    branchIds: ds.branches.map((b) => b.id),
  });
  const overview = buildOverview(ds, filters);

  return (
    <FilterTransition>
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            {overview.scopeName} · {formatRange(filters.range)}
            {overview.branch && (
              <>
                {" · "}
                <Link href={hrefWithFilters("/", filters, { branchId: null })} className="text-primary hover:underline">
                  Back to all branches
                </Link>
              </>
            )}
          </p>
        </div>
        <FilterBar
          path="/"
          filters={filters}
          months={ds.months}
          branches={ds.branches.map((b) => ({ id: b.id, name: b.name }))}
        />
      </header>
      <PendingRegion className="flex flex-col gap-6">
        {overview.isEmpty ? (
          <EmptyState
            title="No activity in this period"
            description="No leads were created, booked or lost for this selection. Try a wider date range or another branch."
            action={
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href="/">Reset filters</Link>
              </Button>
            }
          />
        ) : (
          <OverviewSections overview={overview} />
        )}
      </PendingRegion>
    </FilterTransition>
  );
}

function OverviewSections({ overview }: { overview: Overview }) {
  const { kpis: k, deltas, previousRange, filters, asOf } = overview;
  const deltaContext = previousRange ? `vs ${formatRangeCompact(previousRange)}` : undefined;

  return (
    <>
      <InsightBanner insight={overview.insight} />

      <div className="grid gap-4 2xl:grid-cols-[2fr_1fr]">
        <KpiGroup
          title="Performance"
          badge={`${formatRange(filters.range)}${previousRange ? "" : " · no earlier period to compare"}`}
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Booked revenue"
              value={formatINR(k.bookedRevenue)}
              help={METRIC_HELP.bookedRevenue}
              delta={deltas.bookedRevenue}
              deltaContext={deltaContext}
              detail={
                k.targetRevenue
                  ? `${formatPercent(k.revenueAttainment)} of ${formatINR(k.targetRevenue)} target`
                  : undefined
              }
            />
            <KpiCard
              label="Units booked"
              value={formatNumber(k.bookedUnits)}
              help={METRIC_HELP.bookedUnits}
              delta={deltas.bookedUnits}
              deltaContext={deltaContext}
              detail={`${formatNumber(k.deliveredUnits)} delivered so far`}
            />
            <KpiCard
              label="Win rate"
              value={formatPercent(k.winRate)}
              help={METRIC_HELP.winRate}
              delta={deltas.winRate}
              deltaContext={deltaContext}
              detail={`${formatNumber(k.wins)} won · ${formatNumber(k.losses)} lost`}
            />
            <KpiCard
              label="Avg delivery time"
              value={formatDays(k.avgDaysToDeliver)}
              help={METRIC_HELP.avgDaysToDeliver}
              delta={deltas.avgDaysToDeliver}
              deltaContext={deltaContext}
              detail="Order to delivery"
            />
          </div>
        </KpiGroup>
        <KpiGroup title="Right now" badge={`as of ${formatDate(asOf)}`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-2">
            <KpiCard
              label="Open pipeline"
              value={formatINR(k.openPipelineValue)}
              help={METRIC_HELP.openPipeline}
              detail={`${formatNumber(k.openPipelineCount)} leads in progress`}
            />
            <KpiCard
              label="Awaiting delivery"
              value={formatNumber(k.awaitingDeliveryCount)}
              help={METRIC_HELP.awaitingDelivery}
              detail={`${formatINR(k.awaitingDeliveryValue)} booked, not delivered`}
            />
          </div>
        </KpiGroup>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <SectionCard
          title="Monthly bookings vs target"
          description="Units booked per month (by order date). All months shown; the selected range is highlighted."
          help={METRIC_HELP.attainment}
          className="xl:col-span-3"
        >
          <TrendChart data={overview.trend} />
        </SectionCard>
        <SectionCard
          title="Sales funnel"
          description={`${formatNumber(overview.funnel.total)} leads created in ${formatRange(filters.range)}`}
          help={METRIC_HELP.funnel}
          className="xl:col-span-2"
        >
          {overview.funnel.total ? (
            <FunnelChart funnel={overview.funnel} drop={overview.funnelDrop} />
          ) : (
            <EmptyState title="No new leads in this period" className="py-8" />
          )}
        </SectionCard>
      </div>

      <AttentionCard overview={overview} />

      {overview.branch ? (
        <SectionCard
          title={`${overview.branch.name} sales officers`}
          description={`Bookings and win rate in ${formatRange(filters.range)}; open and idle leads as of ${formatDate(asOf)}.`}
          contentClassName="px-0"
        >
          {overview.reps.length ? (
            <RepTable rows={overview.reps} />
          ) : (
            <EmptyState title="No sales officers in this branch" className="mx-4" />
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title="Branch comparison"
          description={`${formatRange(filters.range)} · select a branch to see its team`}
          help={METRIC_HELP.health}
          contentClassName="px-0"
        >
          <BranchTable rows={overview.branches} filters={filters} />
        </SectionCard>
      )}
    </>
  );
}
