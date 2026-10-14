import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { HealthBadge } from "@/components/dashboard/health-badge";
import { InfoTip } from "@/components/dashboard/info-tip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BranchHealthRow } from "@/lib/analytics/overview";
import { hrefWithFilters, type Filters } from "@/lib/filters";
import { formatDays, formatINR, formatNumber, formatPercent } from "@/lib/format";
import { METRIC_HELP } from "@/lib/metric-help";

export function BranchTable({ rows, filters }: { rows: BranchHealthRow[]; filters: Filters }) {
  return (
    <Table className="min-w-[760px] tabular-nums">
      <TableHeader>
        <TableRow>
          <TableHead>Branch</TableHead>
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
          const href = hrefWithFilters("/", filters, { branchId: branch.id });
          return (
            <TableRow key={branch.id} className="group">
              <TableCell>
                <Link href={href} className="font-medium hover:underline focus-visible:underline">
                  {branch.name}
                </Link>
                <span className="block text-xs text-muted-foreground">{branch.city}</span>
              </TableCell>
              <TableCell>
                {health.reasons.length ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="rounded-full focus-visible:outline-2 focus-visible:outline-ring">
                        <HealthBadge health={health} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <ul className="space-y-0.5">
                        {health.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <HealthBadge health={health} />
                )}
              </TableCell>
              <TableCell className="text-right font-medium">{formatINR(kpis.bookedRevenue)}</TableCell>
              <TableCell className="text-right">{formatNumber(kpis.bookedUnits)}</TableCell>
              <TableCell className="text-right">{formatPercent(kpis.unitAttainment)}</TableCell>
              <TableCell className="text-right">{formatPercent(kpis.winRate)}</TableCell>
              <TableCell className="text-right">{formatDays(kpis.avgDaysToDeliver)}</TableCell>
              <TableCell className="text-right">
                {formatINR(kpis.openPipelineValue)}
                <span className="block text-xs text-muted-foreground">{formatNumber(kpis.openPipelineCount)} leads</span>
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
