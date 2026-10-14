import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import { InfoTip } from "@/components/dashboard/info-tip";
import type { Delta } from "@/lib/analytics/delta";
import { cn } from "@/lib/utils";

const ARROWS = { up: ArrowUpRightIcon, down: ArrowDownRightIcon, flat: ArrowRightIcon } as const;
const SENTIMENT = {
  good: "text-good-foreground",
  bad: "text-critical-foreground",
  neutral: "text-muted-foreground",
} as const;

export function KpiCard({
  label,
  value,
  detail,
  help,
  delta,
  deltaContext,
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
  help: string;
  delta?: Delta | null;
  /** e.g. "vs Jul – Sep" */
  deltaContext?: string;
}) {
  const Arrow = delta ? ARROWS[delta.direction] : null;
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <span className="truncate">{label}</span>
        <InfoTip label={label}>{help}</InfoTip>
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {delta && Arrow && (
        <p className="flex items-center gap-1 text-xs">
          <span className={cn("inline-flex items-center gap-0.5 font-medium", SENTIMENT[delta.sentiment])}>
            <Arrow className="size-3.5" aria-hidden />
            {delta.label}
          </span>
          {deltaContext && <span className="text-muted-foreground">{deltaContext}</span>}
        </p>
      )}
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

/** A labelled group of KPI cards, so range metrics and snapshots never blur together. */
export function KpiGroup({
  title,
  badge,
  className,
  children,
}: {
  title: string;
  badge: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex items-baseline gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
        <span className="text-xs text-muted-foreground">{badge}</span>
      </div>
      {children}
    </section>
  );
}
