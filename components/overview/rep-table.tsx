import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RepRow } from "@/lib/analytics/comparison";
import { THRESHOLDS } from "@/lib/analytics/definitions";
import { formatINR, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RepTable({ rows }: { rows: RepRow[] }) {
  return (
    <Table className="min-w-[640px] tabular-nums">
      <TableHeader>
        <TableRow>
          <TableHead>Sales officer</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Units</TableHead>
          <TableHead className="text-right">Win rate</TableHead>
          <TableHead className="text-right">Open leads</TableHead>
          <TableHead className="text-right">Idle {THRESHOLDS.staleLeadDays}+ days</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.rep.id}>
            <TableCell className="font-medium">{r.rep.name}</TableCell>
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
