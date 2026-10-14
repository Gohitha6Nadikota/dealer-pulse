import { AlertTriangleIcon, CheckCircle2Icon, EyeIcon } from "lucide-react";
import { HEALTH_LABELS, type Health } from "@/lib/analytics/health";
import { cn } from "@/lib/utils";

const STYLES = {
  healthy: { icon: CheckCircle2Icon, className: "bg-good-surface text-good-foreground" },
  watch: { icon: EyeIcon, className: "bg-warning-surface text-warning-foreground" },
  act: { icon: AlertTriangleIcon, className: "bg-critical-surface text-critical-foreground" },
} as const;

/** Status pill: icon + label, never color alone. */
export function HealthBadge({ health, className }: { health: Health; className?: string }) {
  const { icon: Icon, className: tone } = STYLES[health.level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {HEALTH_LABELS[health.level]}
    </span>
  );
}
