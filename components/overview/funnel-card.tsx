import { STAGE_LABELS } from "@/lib/analytics/definitions";
import type { Funnel, biggestDrop } from "@/lib/analytics/funnel";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Horizontal funnel: bar length = share of the cohort that reached each stage. */
export function FunnelChart({
  funnel,
  drop,
}: {
  funnel: Funnel;
  drop: ReturnType<typeof biggestDrop>;
}) {
  const total = funnel.total;
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2.5">
        {funnel.stages.map((stage) => {
          const share = total ? stage.reached / total : 0;
          const isDrop = drop?.to === stage.stage;
          return (
            <li key={stage.stage} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 text-sm">
              <span className="truncate text-muted-foreground">{STAGE_LABELS[stage.stage]}</span>
              <div className="h-5 rounded-[4px] bg-muted" aria-hidden>
                <div
                  className="h-full rounded-[4px] bg-chart-1"
                  style={{ width: `${Math.max(share * 100, stage.reached ? 1 : 0)}%` }}
                />
              </div>
              <span className="text-right tabular-nums">
                <span className="font-medium">{formatNumber(stage.reached)}</span>
                {stage.conversion !== null && (
                  <span
                    className={cn(
                      "block text-xs",
                      isDrop ? "font-medium text-critical-foreground" : "text-muted-foreground",
                    )}
                  >
                    {formatPercent(stage.conversion)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">
        Percentages are conversion from the previous stage. {formatNumber(funnel.lost)} of{" "}
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
      </p>
    </div>
  );
}
