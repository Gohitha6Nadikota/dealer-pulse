import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Small (i) button that explains a metric. Keyboard-focusable. */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={`About ${label}`}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <InfoIcon className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-pretty leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  );
}
