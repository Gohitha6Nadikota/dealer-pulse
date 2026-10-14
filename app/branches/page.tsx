import type { Metadata } from "next";
import { Suspense } from "react";
import { BranchTable } from "@/components/dashboard/branch-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { SectionCard } from "@/components/dashboard/section-card";
import { FilterBar } from "@/components/filters/filter-bar";
import { FilterTransition, PendingRegion } from "@/components/filters/filter-transition";
import { branchRows } from "@/lib/analytics/scope";
import { statusConflictSummary } from "@/lib/analytics/status-conflicts";
import { getDataset } from "@/lib/data";
import { hrefWithFilters, parseRangeFilters } from "@/lib/filters";
import { formatNumber, formatRange } from "@/lib/format";
import { METRIC_HELP } from "@/lib/metric-help";

export const metadata: Metadata = { title: "Branches" };

export default function BranchesPage({ searchParams }: PageProps<"/branches">) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Suspense fallback={<PageSkeleton label="Loading branches" />}>
        <BranchesContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BranchesContent({ searchParams }: Pick<PageProps<"/branches">, "searchParams">) {
  const ds = getDataset();
  const filters = parseRangeFilters(await searchParams, {
    months: ds.months,
    branchIds: ds.branches.map((b) => b.id),
  });
  const rows = branchRows(ds, filters.range);
  const conflicts = statusConflictSummary(ds.leads, ds.branches);

  return (
    <FilterTransition>
      <PageHeader
        crumbs={[{ label: "Overview", href: hrefWithFilters("/", filters) }, { label: "Branches" }]}
        title="Branches"
        subtitle={`${formatNumber(rows.length)} branches · ${formatRange(filters.range)}`}
      >
        <FilterBar path="/branches" filters={filters} months={ds.months} />
      </PageHeader>
      <PendingRegion>
        <SectionCard
          title="Branch comparison"
          description="Highest booked revenue first. Select a branch for its team, funnel and open leads."
          help={METRIC_HELP.health}
          contentClassName="px-0"
        >
          <BranchTable rows={rows} filters={filters} conflicts={conflicts.byBranch} />
        </SectionCard>
      </PendingRegion>
    </FilterTransition>
  );
}
