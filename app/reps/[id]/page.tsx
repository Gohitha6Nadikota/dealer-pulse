import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AttentionCard } from "@/components/dashboard/attention-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { InsightBanner } from "@/components/dashboard/insight-banner";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { PipelineCard } from "@/components/dashboard/pipeline-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusConflictNotice } from "@/components/dashboard/status-conflict-notice";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { FilterBar } from "@/components/filters/filter-bar";
import { FilterTransition, PendingRegion } from "@/components/filters/filter-transition";
import { LeadTable } from "@/components/leads/lead-table";
import { buildRepView } from "@/lib/analytics/rep-view";
import { statusConflictNotice } from "@/lib/analytics/status-conflicts";
import { actionsHref } from "@/lib/action-params";
import { getDataset, getRep } from "@/lib/data";
import { hrefWithFilters, parseRangeFilters } from "@/lib/filters";
import { formatDate, formatNumber, formatPercent, formatRange } from "@/lib/format";
import { METRIC_HELP } from "@/lib/metric-help";

/** Officers only: branch managers own no leads, so their ids 404. */
function getSalesOfficer(id: string) {
  const rep = getRep(id);
  return rep?.role === "sales_officer" ? rep : undefined;
}

export function generateStaticParams() {
  return getDataset()
    .reps.filter((r) => r.role === "sales_officer")
    .map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: PageProps<"/reps/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getSalesOfficer(id)?.name ?? "Sales officer not found" };
}

export default async function RepPage({ params, searchParams }: PageProps<"/reps/[id]">) {
  const { id } = await params;
  if (!getSalesOfficer(id)) notFound();
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Suspense fallback={<PageSkeleton label="Loading sales officer" />}>
        <RepContent id={id} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function RepContent({ id, searchParams }: { id: string } & Pick<PageProps<"/reps/[id]">, "searchParams">) {
  const ds = getDataset();
  const filters = parseRangeFilters(await searchParams, {
    months: ds.months,
    branchIds: ds.branches.map((b) => b.id),
  });
  const view = buildRepView(ds, id, filters);
  if (!view) notFound();
  const { rep, branch, manager, asOf, rank } = view;

  return (
    <FilterTransition>
      <PageHeader
        crumbs={[
          { label: "Overview", href: hrefWithFilters("/", filters) },
          { label: "Branches", href: hrefWithFilters("/branches", filters) },
          { label: branch.name, href: hrefWithFilters(`/branches/${branch.id}`, filters) },
          { label: rep.name },
        ]}
        title={rep.name}
        subtitle={
          <>
            Sales officer, {branch.name} · joined {formatDate(rep.joined)}
            {manager && <> · reports to {manager.name}</>} · #{rank.position} of {rank.of} by revenue in{" "}
            {formatRange(filters.range)}
          </>
        }
      >
        <FilterBar path={`/reps/${rep.id}`} filters={filters} months={ds.months} />
      </PageHeader>

      <PendingRegion className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <InsightBanner insight={view.insight} />
          <StatusConflictNotice
            notice={statusConflictNotice(view.statusConflicts, rep.name)}
            href={actionsHref(filters, { reason: "status_conflict", ownerId: rep.id })}
          />
        </div>
        <KpiStrip
          summary={view}
          asOf={asOf}
          pipelineConflicts={view.statusConflicts.count}
          revenueDetail={
            view.revenueShare !== null ? `${formatPercent(view.revenueShare)} of branch revenue · no rep targets` : "No rep targets in the data"
          }
        />

        <div className="grid gap-4 xl:grid-cols-5">
          <SectionCard
            title="Monthly bookings"
            description="Units booked per month (by order date). Targets exist per branch only. The selected range is highlighted."
            className="xl:col-span-3"
          >
            <TrendChart data={view.trend} />
          </SectionCard>
          <SectionCard
            title="Funnel vs branch"
            description={`${formatNumber(view.funnel.total)} leads created in ${formatRange(filters.range)}`}
            help={METRIC_HELP.funnel}
            className="xl:col-span-2"
          >
            {view.funnel.total ? (
              <FunnelChart
                funnel={view.funnel}
                drop={view.funnelDrop}
                comparison={{ stages: view.funnelVsBranch, label: branch.name }}
                conflicts={view.funnelConflicts}
              />
            ) : (
              <EmptyState title="No new leads in this period" className="py-8" />
            )}
          </SectionCard>
        </div>

        <PipelineCard stages={view.pipeline} asOf={asOf} />
        <AttentionCard attention={view.attention} asOf={asOf} href={actionsHref(filters, { ownerId: rep.id })} />

        <SectionCard
          title="Assigned leads"
          description={`All ${formatNumber(view.leads.length)} leads assigned to ${rep.name}, not affected by the date filter. Select a lead for its timeline.`}
          contentClassName="px-0"
        >
          <LeadTable rows={view.leads} buckets={["open", "awaiting", "delivered", "lost", "all"]} defaultBucket="open" />
        </SectionCard>
      </PendingRegion>
    </FilterTransition>
  );
}
