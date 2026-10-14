import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RepRow } from "@/lib/analytics/comparison";
import { THRESHOLDS } from "@/lib/analytics/definitions";
import { hrefWithFilters, type Filters } from "@/lib/filters";
import { formatINR, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Sales officers in a branch; each row links to the officer's page, keeping the date filter. */
export function RepTable({ rows, filters }: { rows: RepRow[]; filters: Filters }) {
  return (
    <Table className="min-w-[680px] tabular-nums">
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Sales officer</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Units</TableHead>
          <TableHead className="text-right">Win rate</TableHead>
          <TableHead className="text-right">Open leads</TableHead>
          <TableHead className="text-right">Idle {THRESHOLDS.staleLeadDays}+ days</TableHead>
          <TableHead className="w-8">
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const href = hrefWithFilters(`/reps/${r.rep.id}`, filters, { branchId: null });
          return (
            <TableRow key={r.rep.id} className="group">
              <TableCell className="pl-4">
                <Link href={href} className="font-medium hover:underline focus-visible:underline">
                  {r.rep.name}
                </Link>
                <span className="block text-xs text-muted-foreground">{formatNumber(r.totalLeads)} leads assigned</span>
              </TableCell>
              <TableCell className="text-right font-medium">{formatINR(r.bookedRevenue)}</TableCell>
              <TableCell className="text-right">{formatNumber(r.bookedUnits)}</TableCell>
              <TableCell className="text-right">
                {formatPercent(r.winRate)}
                <span className="block text-xs text-muted-foreground">
                  {r.wins} won · {r.losses} lost
                </span>
              </TableCell>
              <TableCell className="text-right">{formatNumber(r.openLeads)}</TableCell>
              <TableCell className={cn("text-right", r.idleLeads > 0 && "font-medium text-warning-foreground")}>
                {formatNumber(r.idleLeads)}
              </TableCell>
              <TableCell>
                <Link href={href} aria-label={`View ${r.rep.name}`} tabIndex={-1} className="text-muted-foreground group-hover:text-foreground">
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
