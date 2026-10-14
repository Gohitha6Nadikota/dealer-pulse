import { STAGE_LABELS } from "@/lib/analytics/definitions";
import type { LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Neutral stage pill; status colors are reserved for health. */
export function StageBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap",
        status === "lost" ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          status === "lost" ? "bg-muted-foreground/50" : status === "delivered" ? "bg-foreground/70" : "bg-chart-1",
        )}
      />
      {STAGE_LABELS[status]}
    </span>
  );
}
