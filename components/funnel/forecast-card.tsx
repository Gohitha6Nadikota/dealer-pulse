import { EmptyState } from "@/components/dashboard/empty-state";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STAGE_LABELS } from "@/lib/analytics/definitions";
import { FORECAST_MIN_STAGE_SAMPLE, type Forecast } from "@/lib/analytics/forecast";
import { formatDays, formatINR, formatMonth, formatNumber, formatPercent, formatRange } from "@/lib/format";

/** Pipeline outlook with its method and limits stated next to the numbers. */
export function ForecastSection({ forecast, scopeName }: { forecast: Forecast; scopeName: string }) {
  const { window, pipeline, withoutStatusConflicts: clean } = forecast;
  if (!window || !pipeline) {
    return (
      <EmptyState
        title="Not enough history for an outlook"
        description="No creation month has every lead resolved yet, so conversion rates would be biased."
        className="mx-4"
      />
    );
  }
  if (pipeline.openLeads === 0) {
    return <EmptyState title="No open leads" description={`${scopeName} has nothing in the pipeline right now.`} className="mx-4" />;
  }
  const usesCompany = forecast.probabilities.some((p) => p.source === "company");

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 px-4 md:grid-cols-3">
        <KpiCard
          label="Likely orders"
          value={`~${formatNumber(Math.round(pipeline.expectedOrders))}`}
          help="Sum of each open lead's historical chance of ordering. The range covers outcome luck only."
          detail={`range ${formatNumber(pipeline.ordersRange[0])}–${formatNumber(pipeline.ordersRange[1])} of ${formatNumber(pipeline.openLeads)} open leads`}
        />
        <KpiCard
          label="Likely booked value"
          value={`~${formatINR(pipeline.expectedValue)}`}
          help="Sum of deal value × historical chance of ordering for each open lead."
          detail={`range ${formatINR(pipeline.valueRange[0])}–${formatINR(pipeline.valueRange[1])} of ${formatINR(pipeline.pipelineValue)} pipeline`}
        />
        <KpiCard
          label="Without status conflicts"
          value={clean ? `~${formatNumber(Math.round(clean.expectedOrders))} orders` : "—"}
          help="The same outlook excluding leads stored as lost without a loss event, in case they really are lost."
          detail={
            clean && forecast.statusConflicts > 0
              ? `~${formatINR(clean.expectedValue)}, excluding ${formatNumber(forecast.statusConflicts)} conflicted leads`
              : "No conflicted leads in this scope"
          }
        />
      </div>

      <Table className="min-w-[760px] tabular-nums">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Current stage</TableHead>
            <TableHead className="text-right">Open leads</TableHead>
            <TableHead className="text-right">Pipeline</TableHead>
            <TableHead className="text-right">Historical chance of ordering</TableHead>
            <TableHead className="text-right">Likely orders</TableHead>
            <TableHead className="text-right">Likely value</TableHead>
            <TableHead className="pr-4 text-right">Typical time to order</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pipeline.stages.map((s, i) => {
            const prob = forecast.probabilities[i];
            const own = forecast.ownProbabilities[i];
            return (
              <TableRow key={s.stage}>
                <TableCell className="pl-4 font-medium">{STAGE_LABELS[s.stage]}</TableCell>
                <TableCell className="text-right">{formatNumber(s.openLeads)}</TableCell>
                <TableCell className="text-right">{formatINR(s.pipelineValue)}</TableCell>
                <TableCell className="text-right">
                  {formatPercent(s.p)}
                  <span className="block text-[11px] text-muted-foreground">
                    {prob.source === "company"
                      ? `company (${formatNumber(prob.ordered)}/${formatNumber(prob.reached)}); own ${formatNumber(own.ordered)}/${formatNumber(own.reached)} too few`
                      : `${formatNumber(prob.ordered)} of ${formatNumber(prob.reached)}`}
                  </span>
                </TableCell>
                <TableCell className="text-right">{s.openLeads ? s.expectedOrders.toFixed(1) : "—"}</TableCell>
                <TableCell className="text-right">{s.openLeads ? formatINR(s.expectedValue) : "—"}</TableCell>
                <TableCell className="pr-4 text-right text-muted-foreground">
                  {s.medianDaysToOrder === null ? "—" : `~${formatDays(s.medianDaysToOrder, 0)}`}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="pl-4">Total</TableCell>
            <TableCell className="text-right">{formatNumber(pipeline.openLeads)}</TableCell>
            <TableCell className="text-right">{formatINR(pipeline.pipelineValue)}</TableCell>
            <TableCell />
            <TableCell className="text-right">{pipeline.expectedOrders.toFixed(1)}</TableCell>
            <TableCell className="text-right">{formatINR(pipeline.expectedValue)}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>

      <div className="px-4">
        <h3 className="text-sm font-medium">How this is calculated, and what it can&apos;t tell you</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground">History:</span> {formatNumber(window.leads)} leads created{" "}
            {formatRange(window)}, the months in which every lead has already ordered or been lost. Leads created after{" "}
            {formatMonth(window.to)} are left out because many are still open, which would bias the rates.
          </li>
          <li>
            <span className="text-foreground">Chance of ordering:</span> of past leads that reached a stage, the share that
            went on to order. {scopeName === "All branches" ? "Company-wide rates." : `${scopeName}'s own rate where it has at least ${FORECAST_MIN_STAGE_SAMPLE} past leads at that stage, otherwise the company rate.`}
            {usesCompany && " Company rates may flatter a branch that converts worse than average."}
          </li>
          <li>
            <span className="text-foreground">Range:</span> about 90%, from outcome luck alone, assuming deals are independent.
            It does not cover changes in demand, pricing or team behaviour, so real uncertainty is wider.
          </li>
          <li>
            <span className="text-foreground">No dates:</span> this is how many open leads are likely to order eventually,
            not this month&apos;s bookings. The typical time to order is a median, for orientation only.
          </li>
          <li>
            <span className="text-foreground">Small pipeline:</span> with {formatNumber(pipeline.openLeads)} open leads, a few
            large deals swing the total.
          </li>
        </ul>
      </div>
    </div>
  );
}
