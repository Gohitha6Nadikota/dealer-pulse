import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STAGE_LABELS } from "@/lib/analytics/definitions";
import { LEAK_STAGES, MIN_LEAK_SAMPLE, type LeakCell, type LeakRow } from "@/lib/analytics/leaks";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const VERDICT = {
  leak: { label: "Leak", className: "bg-critical-surface text-critical-foreground" },
  better: { label: "Better", className: "bg-good-surface text-good-foreground" },
  normal: { label: "", className: "" },
  small_sample: { label: `Fewer than ${MIN_LEAK_SAMPLE}`, className: "text-muted-foreground" },
  no_data: { label: "", className: "text-muted-foreground" },
} as const;

/** Loss rate per stage for each row, marked where it differs from the company beyond chance. */
export function LeakMatrix({ rows, rowLabel }: { rows: LeakRow[]; rowLabel: string }) {
  return (
    <Table className="min-w-[720px] tabular-nums">
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">{rowLabel}</TableHead>
          {LEAK_STAGES.map((s) => (
            <TableHead key={s} className="text-right">
              Lost at {STAGE_LABELS[s]}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="pl-4">
              <Link href={row.href} className="font-medium hover:underline">
                {row.name}
              </Link>
            </TableCell>
            {row.cells.map((cell) => (
              <LeakCellView key={cell.stage} cell={cell} />
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LeakCellView({ cell }: { cell: LeakCell }) {
  const v = VERDICT[cell.verdict];
  const muted = cell.verdict === "small_sample" || cell.verdict === "no_data";
  return (
    <TableCell className="text-right">
      <span className={cn("inline-flex flex-col items-end rounded-md px-1.5 py-0.5", (cell.verdict === "leak" || cell.verdict === "better") && v.className)}>
        <span className={cn("font-medium", muted && "text-muted-foreground")}>
          {cell.reached ? formatPercent(cell.rate) : "—"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {formatNumber(cell.lost)} of {formatNumber(cell.reached)}
          {v.label && <> · {v.label}</>}
        </span>
      </span>
    </TableCell>
  );
}
