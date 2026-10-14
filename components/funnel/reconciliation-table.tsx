import { InfoTip } from "@/components/dashboard/info-tip";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STAGE_LABELS } from "@/lib/analytics/definitions";
import type { FunnelReconciliation } from "@/lib/analytics/leaks";
import { formatNumber, formatPercent } from "@/lib/format";

/** Every lead that reached a stage, accounted for exactly once. */
export function ReconciliationTable({
  data,
  company,
  showCompany,
}: {
  data: FunnelReconciliation;
  company: FunnelReconciliation;
  showCompany: boolean;
}) {
  const o = data.outcome;
  return (
    <div className="flex flex-col gap-3">
      <Table className="min-w-[680px] tabular-nums">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Stage</TableHead>
            <TableHead className="text-right">Reached</TableHead>
            <TableHead className="text-right">Moved on</TableHead>
            <TableHead className="text-right">Lost here</TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1">
                Still here
                <InfoTip label="Still here">
                  Leads currently at this stage. &ldquo;Stored as lost&rdquo; leads are included here, not in Lost here:
                  they are excluded from genuine losses because no loss event or loss reason is recorded.
                </InfoTip>
              </span>
            </TableHead>
            <TableHead className="text-right">Loss rate</TableHead>
            {showCompany && <TableHead className="pr-4 text-right">Company loss rate</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.stages.map((s, i) => (
            <TableRow key={s.stage}>
              <TableCell className="pl-4 font-medium">{STAGE_LABELS[s.stage]}</TableCell>
              <TableCell className="text-right">{formatNumber(s.reached)}</TableCell>
              <TableCell className="text-right">{s.stage === "delivered" ? "—" : formatNumber(s.movedOn)}</TableCell>
              <TableCell className="text-right">{formatNumber(s.lostHere)}</TableCell>
              <TableCell className="text-right">
                {formatNumber(s.stillHere)}
                {s.dataIssue > 0 && (
                  <span className="block text-xs text-warning-foreground">{formatNumber(s.dataIssue)} stored as lost</span>
                )}
              </TableCell>
              <TableCell className="text-right">{s.stage === "delivered" ? "—" : formatPercent(s.lossRate)}</TableCell>
              {showCompany && (
                <TableCell className="pr-4 text-right text-muted-foreground">
                  {s.stage === "delivered" ? "—" : formatPercent(company.stages[i].lossRate)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={showCompany ? 7 : 6} className="pl-4 text-xs font-normal whitespace-normal text-muted-foreground">
              {formatNumber(data.total)} leads = {formatNumber(o.delivered)} delivered + {formatNumber(o.awaiting)} awaiting
              delivery + {formatNumber(o.open)} open
              {o.openDataIssue > 0 && ` (${formatNumber(o.openDataIssue)} of them stored as lost)`} +{" "}
              {formatNumber(o.lost)} lost. Reached = moved on + lost here + still here at every stage.
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
