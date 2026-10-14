import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STAGE_LABELS } from "@/lib/analytics/definitions";
import { LEAK_STAGES, type LossReasonByStage } from "@/lib/analytics/leaks";
import { formatNumber, formatPercent } from "@/lib/format";

export function LossReasonsTable({ rows }: { rows: LossReasonByStage[] }) {
  const total = rows.reduce((n, r) => n + r.total, 0);
  return (
    <Table className="min-w-[640px] tabular-nums">
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Loss reason</TableHead>
          <TableHead className="text-right">Leads</TableHead>
          {LEAK_STAGES.map((s) => (
            <TableHead key={s} className="text-right">
              {STAGE_LABELS[s]}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.reason}>
            <TableCell className="pl-4">{r.reason}</TableCell>
            <TableCell className="text-right font-medium">
              {formatNumber(r.total)} <span className="text-xs font-normal text-muted-foreground">{formatPercent(r.total / total)}</span>
            </TableCell>
            {LEAK_STAGES.map((s) => (
              <TableCell key={s} className="text-right text-muted-foreground">
                {r.byStage[s] || "·"}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
