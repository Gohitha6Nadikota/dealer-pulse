import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AttentionCard } from "@/components/dashboard/attention-card";
import { BranchTable } from "@/components/dashboard/branch-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
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
import { Button } from "@/components/ui/button";
import { buildOverview, type Overview } from "@/lib/analytics/overview";
import { statusConflictNotice } from "@/lib/analytics/status-conflicts";
import { actionsHref } from "@/lib/action-params";
import { getDataset } from "@/lib/data";
import { hrefWithFilters, parseFilters } from "@/lib/filters";
import { formatDate, formatNumber, formatRange } from "@/lib/format";
import { METRIC_HELP } from "@/lib/metric-help";

// The root layout's title template only applies to nested segments, so the root page sets its full title.
export const metadata: Metadata = { title: { absolute: "Overview · DealerPulse" } };

export default function OverviewPage({ searchParams }: PageProps<"/">) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Suspense fallback={<PageSkeleton label="Loading overview" />}>
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
      <PageHeader
        title="Overview"
        subtitle={
          <>
            {overview.scopeName} · {formatRange(filters.range)}
            {overview.branch && (
              <>
                {" · "}
                <Link
                  href={hrefWithFilters(`/branches/${overview.branch.id}`, filters, { branchId: null })}
                  className="text-primary hover:underline"
                >
                  Open branch page
                </Link>
              </>
            )}
          </>
        }
      >
        <FilterBar
          path="/"
          filters={filters}
          months={ds.months}
          branches={ds.branches.map((b) => ({ id: b.id, name: b.name }))}
        />
      </PageHeader>
      {/* A dataset finding, not a period metric: shown whatever the date range. */}
      <StatusConflictNotice
        notice={statusConflictNotice(overview.statusConflicts, overview.branch?.name ?? null)}
        href={actionsHref(filters, { reason: "status_conflict" })}
      />
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
  const { filters, asOf } = overview;
  return (
    <>
      <InsightBanner insight={overview.insight} />
      <KpiStrip summary={overview} asOf={asOf} pipelineConflicts={overview.statusConflicts.count} />

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
            <FunnelChart funnel={overview.funnel} drop={overview.funnelDrop} conflicts={overview.funnelConflicts} />
          ) : (
            <EmptyState title="No new leads in this period" className="py-8" />
          )}
        </SectionCard>
      </div>

      <AttentionCard attention={overview.attention} asOf={asOf} href={actionsHref(filters)} />

      {overview.branch ? (
        <SectionCard
          title={`${overview.branch.name} sales officers`}
          description={`Bookings and win rate in ${formatRange(filters.range)}; open and idle leads as of ${formatDate(asOf)} (UTC).`}
          contentClassName="px-0"
        >
          {overview.reps.length ? (
            <RepTable rows={overview.reps} filters={filters} />
          ) : (
            <EmptyState title="No sales officers in this branch" className="mx-4" />
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title="Branch comparison"
          description={`${formatRange(filters.range)} · select a branch for its full page`}
          help={METRIC_HELP.health}
          contentClassName="px-0"
        >
          <BranchTable rows={overview.branches} filters={filters} conflicts={overview.statusConflicts.byBranch} />
        </SectionCard>
      )}
    </>
  );
}
