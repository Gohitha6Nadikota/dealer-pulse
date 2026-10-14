import { SparklesIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import type { Insight } from "@/lib/analytics/insights";
import { cn } from "@/lib/utils";

const TONE = {
  positive: { icon: TrendingUpIcon, className: "text-good-foreground bg-good-surface" },
  negative: { icon: TrendingDownIcon, className: "text-critical-foreground bg-critical-surface" },
  neutral: { icon: SparklesIcon, className: "text-primary bg-sidebar-accent" },
} as const;

/** The one-sentence answer to "how are we doing?", generated from rules. */
export function InsightBanner({ insight }: { insight: Insight }) {
  const { icon: Icon, className } = TONE[insight.tone];
  return (
    <section aria-label="Headline" className="flex gap-4 rounded-xl border bg-card p-5">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", className)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 space-y-2">
        <p className="text-lg leading-snug font-semibold text-balance md:text-xl">{insight.headline}</p>
        {insight.supporting.length > 0 && (
          <ul className="flex flex-col gap-x-5 gap-y-1 text-sm text-muted-foreground md:flex-row md:flex-wrap">
            {insight.supporting.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
