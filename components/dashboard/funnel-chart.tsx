import { STAGE_LABELS } from "@/lib/analytics/definitions";
import type { Funnel, biggestDrop } from "@/lib/analytics/funnel";
import type { FunnelComparisonStage } from "@/lib/analytics/scope";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Horizontal funnel: bar length = share of the cohort that reached each stage.
 * With a comparison, each step also shows the benchmark's conversion.
 */
export function FunnelChart({
  funnel,
  drop,
  comparison,
  conflicts = 0,
}: {
  funnel: Funnel;
  drop: ReturnType<typeof biggestDrop>;
  comparison?: { stages: FunnelComparisonStage[]; label: string };
  /** Cohort leads stored as lost without a loss event; counted as open, not lost. */
  conflicts?: number;
}) {
  const total = funnel.total;
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2.5">
        {funnel.stages.map((stage, i) => {
          const share = total ? stage.reached / total : 0;
          const isDrop = drop?.to === stage.stage;
          const compare = comparison?.stages[i];
          return (
            <li key={stage.stage} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate text-muted-foreground">{STAGE_LABELS[stage.stage]}</span>
              <div className="h-5 rounded-[4px] bg-muted" aria-hidden>
                <div
                  className="h-full rounded-[4px] bg-chart-1"
                  style={{ width: `${Math.max(share * 100, stage.reached ? 1 : 0)}%` }}
                />
              </div>
              <span className="min-w-14 text-right tabular-nums">
                <span className="font-medium">{formatNumber(stage.reached)}</span>
                {stage.conversion !== null && (
                  <span
                    className={cn(
                      "block text-xs",
                      isDrop || compare?.belowBenchmark
                        ? "font-medium text-critical-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatPercent(stage.conversion)}
                    {compare && compare.benchmark !== null && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        / {formatPercent(compare.benchmark)}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">
        Percentages are conversion from the previous stage
        {comparison ? ` (this scope / ${comparison.label})` : ""}. {formatNumber(funnel.lost)} of{" "}
        {formatNumber(total)} leads were lost.
        {drop && (
          <>
            {" "}
            Biggest drop:{" "}
            <span className="font-medium text-foreground">
              {STAGE_LABELS[drop.from]} → {STAGE_LABELS[drop.to]}
            </span>{" "}
            ({formatPercent(drop.conversion)} convert).
          </>
        )}
        {conflicts > 0 && (
          <span className="mt-1 block text-warning-foreground">
            {formatNumber(conflicts)} {conflicts === 1 ? "lead is" : "leads are"} stored as lost but excluded from
            genuine losses, because no loss event or loss reason is recorded.
          </span>
        )}
      </p>
    </div>
  );
}
