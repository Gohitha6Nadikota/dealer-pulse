import { AlertTriangleIcon, EyeIcon, InfoIcon } from "lucide-react";
import { SEVERITY_LABELS, type Severity } from "@/lib/action-params";
import { cn } from "@/lib/utils";

const STYLES = {
  critical: { icon: AlertTriangleIcon, className: "bg-critical-surface text-critical-foreground" },
  warning: { icon: EyeIcon, className: "bg-warning-surface text-warning-foreground" },
  review: { icon: InfoIcon, className: "bg-muted text-muted-foreground" },
} as const;

/** Icon + label, never color alone. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  const { icon: Icon, className } = STYLES[severity];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}>
      <Icon className="size-3.5" aria-hidden />
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
