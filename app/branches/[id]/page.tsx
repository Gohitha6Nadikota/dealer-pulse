import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
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
import { TrendChart } from "@/components/dashboard/trend-chart";
import { FilterBar } from "@/components/filters/filter-bar";
import { FilterTransition, PendingRegion } from "@/components/filters/filter-transition";
import { LeadTable } from "@/components/leads/lead-table";
import { buildBranchView } from "@/lib/analytics/branch-view";
import { getBranch, getDataset } from "@/lib/data";
import { hrefWithFilters, parseRangeFilters } from "@/lib/filters";
import { formatDate, formatNumber, formatRange } from "@/lib/format";
import { METRIC_HELP } from "@/lib/metric-help";

/** Every branch is prerendered; unknown ids 404 before streaming starts. */
export function generateStaticParams() {
  return getDataset().branches.map((b) => ({ id: b.id }));
}

export async function generateMetadata({ params }: PageProps<"/branches/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getBranch(id)?.name ?? "Branch not found" };
}

export default async function BranchPage({ params, searchParams }: PageProps<"/branches/[id]">) {
  const { id } = await params;
  if (!getBranch(id)) notFound();
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Suspense fallback={<PageSkeleton label="Loading branch" />}>
        <BranchContent id={id} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BranchContent({
  id,
  searchParams,
}: { id: string } & Pick<PageProps<"/branches/[id]">, "searchParams">) {
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
        badge={<HealthBadgeWithReasons health={view.health} />}
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
        <InsightBanner insight={view.insight} />
        <KpiStrip summary={view} asOf={asOf} />

        <div className="grid gap-4 xl:grid-cols-5">
          <SectionCard
            title="Monthly bookings vs branch target"
            description="Units booked per month (by order date). The selected range is highlighted."
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
              />
            ) : (
              <EmptyState title="No new leads in this period" className="py-8" />
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="Sales officers"
          description={`Bookings and win rate in ${formatRange(filters.range)}; open and idle leads as of ${formatDate(asOf)}. Select an officer for their leads.`}
          contentClassName="px-0"
        >
          {view.reps.length ? (
            <RepTable rows={view.reps} filters={filters} />
          ) : (
            <EmptyState title="No sales officers in this branch" className="mx-4" />
          )}
        </SectionCard>

        <AttentionCard attention={view.attention} asOf={asOf} />

        <SectionCard
          title="Open leads and orders"
          description={`As of ${formatDate(asOf)}, not affected by the date filter. Select a lead for its timeline.`}
          contentClassName="px-0"
        >
          <LeadTable rows={view.openLeads} buckets={["open", "awaiting", "all"]} defaultBucket="open" showRep />
        </SectionCard>
      </PendingRegion>
    </FilterTransition>
  );
}
