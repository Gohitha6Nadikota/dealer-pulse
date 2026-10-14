import { KpiCard, KpiGroup } from "@/components/dashboard/kpi-card";
import type { ScopeSummary } from "@/lib/analytics/scope";
import { formatDate, formatDays, formatINR, formatNumber, formatPercent, formatRange, formatRangeCompact } from "@/lib/format";
import { METRIC_HELP } from "@/lib/metric-help";

/**
 * Range metrics ("Performance") and point-in-time metrics ("Right now"),
 * always as two labelled groups so they never blur together.
 */
export function KpiStrip({
  summary,
  asOf,
  revenueDetail,
  pipelineConflicts = 0,
}: {
  summary: ScopeSummary;
  asOf: string;
  /** Replaces the target line under revenue, e.g. for a rep with no target. */
  revenueDetail?: string;
  /** Open leads that are CRM status conflicts (stored as lost), shown as a qualification. */
  pipelineConflicts?: number;
}) {
  const { kpis: k, deltas, previousRange, range } = summary;
  const deltaContext = previousRange ? `vs ${formatRangeCompact(previousRange)}` : undefined;
  const targetDetail = k.targetRevenue
    ? `${formatPercent(k.revenueAttainment)} of ${formatINR(k.targetRevenue)} target`
    : undefined;

  return (
    <div className="grid gap-4 2xl:grid-cols-[2fr_1fr]">
      <KpiGroup
        title="Performance"
        badge={`${formatRange(range)}${previousRange ? "" : " · no earlier period to compare"}`}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Booked revenue"
            value={formatINR(k.bookedRevenue)}
            help={METRIC_HELP.bookedRevenue}
            delta={deltas.bookedRevenue}
            deltaContext={deltaContext}
            detail={revenueDetail ?? targetDetail}
          />
          <KpiCard
            label="Units booked"
            value={formatNumber(k.bookedUnits)}
            help={METRIC_HELP.bookedUnits}
            delta={deltas.bookedUnits}
            deltaContext={deltaContext}
            detail={`${formatNumber(k.deliveredUnits)} delivered so far`}
          />
          <KpiCard
            label="Win rate"
            value={formatPercent(k.winRate)}
            help={METRIC_HELP.winRate}
            delta={deltas.winRate}
            deltaContext={deltaContext}
            detail={`${formatNumber(k.wins)} won · ${formatNumber(k.losses)} lost`}
          />
          <KpiCard
            label="Avg delivery time"
            value={formatDays(k.avgDaysToDeliver)}
            help={METRIC_HELP.avgDaysToDeliver}
            delta={deltas.avgDaysToDeliver}
            deltaContext={deltaContext}
            detail="Order to delivery"
          />
        </div>
      </KpiGroup>
      <KpiGroup title="Right now" badge={`as of ${formatDate(asOf)} (UTC)`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-2">
          <KpiCard
            label="Open pipeline"
            value={formatINR(k.openPipelineValue)}
            help={METRIC_HELP.openPipeline}
            detail={
              pipelineConflicts > 0
                ? `${formatNumber(k.openPipelineCount)} leads in progress, incl. ${formatNumber(pipelineConflicts)} stored as lost`
                : `${formatNumber(k.openPipelineCount)} leads in progress`
            }
          />
          <KpiCard
            label="Awaiting delivery"
            value={formatNumber(k.awaitingDeliveryCount)}
            help={METRIC_HELP.awaitingDelivery}
            detail={`${formatINR(k.awaitingDeliveryValue)} booked, not delivered`}
          />
        </div>
      </KpiGroup>
    </div>
  );
}
