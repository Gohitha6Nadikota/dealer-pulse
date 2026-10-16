import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { SectionCard } from "@/components/dashboard/section-card";
import { FilterBar } from "@/components/filters/filter-bar";
import { FilterTransition, PendingRegion } from "@/components/filters/filter-transition";
import { ForecastSection } from "@/components/funnel/forecast-card";
import { LeakMatrix } from "@/components/funnel/leak-matrix";
import { LossReasonsTable } from "@/components/funnel/loss-reasons-table";
import { ReconciliationTable } from "@/components/funnel/reconciliation-table";
import { StatusConflicts } from "@/components/funnel/status-conflicts";
import { CarModelsCard, LeadSourcesCard, SegmentCardSkeleton } from "@/components/segments/segment-cards";
import { buildFunnelView } from "@/lib/analytics/funnel-view";
import { LEAK_Z, MIN_LEAK_SAMPLE, leakSentence } from "@/lib/analytics/leaks";
import { getDataset } from "@/lib/data";
import { hrefWithFilters, parseFilters } from "@/lib/filters";
import { formatDate, formatNumber, formatRange } from "@/lib/format";

export const metadata: Metadata = { title: "Funnel & outlook" };

const LEAK_HELP = `Loss rate = leads lost at a stage ÷ leads that reached it, for leads created in the selected range. "Leak" means the rate is higher than the company's by more than chance would explain (z ≥ ${LEAK_Z}). Stages with fewer than ${MIN_LEAK_SAMPLE} leads are shown but not judged.`;

export default function FunnelPage({ searchParams }: PageProps<"/funnel">) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <PageSkeleton label="Loading funnel" />
            <div className="grid gap-4 2xl:grid-cols-2">
              <SegmentCardSkeleton variant="donut" />
              <SegmentCardSkeleton variant="table" />
            </div>
          </div>
        }
      >
        <FunnelContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function FunnelContent({ searchParams }: Pick<PageProps<"/funnel">, "searchParams">) {
  const ds = getDataset();
  const filters = parseFilters(await searchParams, { months: ds.months, branchIds: ds.branches.map((b) => b.id) });
  const view = buildFunnelView(ds, filters);
  const rowLabel = view.branch ? "Sales officer" : "Branch";
  const scope = { name: view.scopeName, period: formatRange(filters.range) };

  return (
    <FilterTransition>
      <PageHeader
        crumbs={[{ label: "Overview", href: hrefWithFilters("/", filters) }, { label: "Funnel & outlook" }]}
        title="Funnel & outlook"
        subtitle={`${view.scopeName} · leads created in ${formatRange(filters.range)}. The outlook and data issues are as of ${formatDate(view.asOf)} (UTC).`}
      >
        <FilterBar path="/funnel" filters={filters} months={ds.months} branches={ds.branches.map((b) => ({ id: b.id, name: b.name }))} />
      </PageHeader>

      <PendingRegion className="flex flex-col gap-6">
        <SectionCard
          title="Where leads leave the funnel"
          description="Every lead that reached a stage either moved on, was lost there, or is still there. Leads created recently have had less time to move on or be lost."
          help={LEAK_HELP}
          contentClassName="px-0"
        >
          {view.reconciliation.total ? (
            <ReconciliationTable data={view.reconciliation} company={view.company} showCompany={view.branch !== null} />
          ) : (
            <EmptyState title="No leads created in this period" className="mx-4" />
          )}
        </SectionCard>

        <SectionCard
          title={view.branch ? `Leaks by sales officer` : "Leaks by branch"}
          description={`Compared with the company for the same period. ${view.branch ? "Officer samples are small, so most cells can't be judged." : ""}`}
          help={LEAK_HELP}
          contentClassName="px-0"
        >
          <div className="flex flex-col gap-4">
            <div className="px-4">
              {view.largest.length ? (
                <ul className="space-y-1.5 text-sm">
                  {view.largest.map((leak) => (
                    <li key={`${leak.row.id}-${leak.cell.stage}`} className="flex gap-2">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-critical" />
                      {leakSentence(leak)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No {rowLabel.toLowerCase()} loses significantly more leads than the company at any stage, among those
                  with at least {MIN_LEAK_SAMPLE} leads to judge.
                </p>
              )}
            </div>
            <LeakMatrix rows={view.leakRows} rowLabel={rowLabel} />
          </div>
        </SectionCard>

        <SectionCard
          title="Why leads were lost, and where"
          description={`${formatNumber(view.reconciliation.outcome.lost)} lost leads by their recorded loss reason and the stage they were lost at. The structured reason is used because ${formatNumber(ds.dataQuality.lossNoteContradictions)} free-text notes (company-wide) contradict it.`}
          contentClassName="px-0"
        >
          {view.lossReasons.length ? (
            <LossReasonsTable rows={view.lossReasons} />
          ) : (
            <EmptyState title="No losses in this period" className="mx-4" />
          )}
        </SectionCard>

        <div className="grid gap-4 2xl:grid-cols-2">
          <LeadSourcesCard segments={view.segments} scope={scope} />
          <CarModelsCard segments={view.segments} scope={scope} />
        </div>

        <SectionCard
          title="Recorded lost, but no loss event"
          description="Inconsistent CRM records, kept apart from genuine losses. Not affected by the date range."
          contentClassName="px-0"
        >
          <StatusConflicts view={view} />
        </SectionCard>

        <SectionCard
          title="Pipeline outlook"
          description={`How much of today's open pipeline is likely to order, based on history. An estimate, not a target. As of ${formatDate(view.asOf)} (UTC); not affected by the date range.`}
          contentClassName="px-0"
        >
          <ForecastSection forecast={view.forecast} scopeName={view.scopeName} />
        </SectionCard>
      </PendingRegion>
    </FilterTransition>
  );
}
