import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { HealthBadgeWithReasons } from "@/components/dashboard/health-badge";
import { InfoTip } from "@/components/dashboard/info-tip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BranchHealthRow } from "@/lib/analytics/scope";
import type { StatusConflictBranch } from "@/lib/analytics/status-conflicts";
import { hrefWithFilters, type Filters } from "@/lib/filters";
import { formatDays, formatINR, formatNumber, formatPercent } from "@/lib/format";
import { METRIC_HELP } from "@/lib/metric-help";

export function BranchTable({
  rows,
  filters,
  conflicts = [],
}: {
  rows: BranchHealthRow[];
  filters: Filters;
  /** Per-branch status conflicts, to qualify each branch's open pipeline. */
  conflicts?: StatusConflictBranch[];
}) {
  return (
    <Table className="min-w-[760px] tabular-nums">
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Branch</TableHead>
          <TableHead>
            <span className="inline-flex items-center gap-1">
              Health <InfoTip label="Health">{METRIC_HELP.health}</InfoTip>
            </span>
          </TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Units</TableHead>
          <TableHead className="text-right">
            <span className="inline-flex items-center gap-1">
              Attainment <InfoTip label="Attainment">{METRIC_HELP.attainment}</InfoTip>
            </span>
          </TableHead>
          <TableHead className="text-right">Win rate</TableHead>
          <TableHead className="text-right">Avg delivery</TableHead>
          <TableHead className="text-right">Open pipeline</TableHead>
          <TableHead className="w-8">
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ branch, kpis, health }) => {
          const href = hrefWithFilters(`/branches/${branch.id}`, filters, { branchId: null });
          return (
            <TableRow key={branch.id} className="group">
              <TableCell className="pl-4">
                <Link href={href} className="font-medium hover:underline focus-visible:underline">
                  {branch.name}
                </Link>
                <span className="block text-xs text-muted-foreground">{branch.city}</span>
              </TableCell>
              <TableCell>
                <HealthBadgeWithReasons health={health} />
              </TableCell>
              <TableCell className="text-right font-medium">{formatINR(kpis.bookedRevenue)}</TableCell>
              <TableCell className="text-right">{formatNumber(kpis.bookedUnits)}</TableCell>
              <TableCell className="text-right">{formatPercent(kpis.unitAttainment)}</TableCell>
              <TableCell className="text-right">{formatPercent(kpis.winRate)}</TableCell>
              <TableCell className="text-right">{formatDays(kpis.avgDaysToDeliver)}</TableCell>
              <TableCell className="text-right">
                {formatINR(kpis.openPipelineValue)}
                <span className="block text-xs text-muted-foreground">{formatNumber(kpis.openPipelineCount)} leads</span>
                <ConflictNote count={conflicts.find((c) => c.branch.id === branch.id)?.conflicts ?? 0} />
              </TableCell>
              <TableCell>
                <Link href={href} aria-label={`View ${branch.name}`} tabIndex={-1} className="text-muted-foreground group-hover:text-foreground">
                  <ChevronRightIcon className="size-4" aria-hidden />
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ConflictNote({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="block text-xs text-warning-foreground">
      {formatNumber(count)} stored as lost
      <span className="sr-only">: excluded from genuine losses because no loss event or loss reason is recorded</span>
    </span>
  );
}
