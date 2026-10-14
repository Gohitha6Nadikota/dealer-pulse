import { SectionCard } from "@/components/dashboard/section-card";
import { STAGE_LABELS } from "@/lib/analytics/definitions";
import type { PipelineStage } from "@/lib/analytics/rep-view";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { METRIC_HELP } from "@/lib/metric-help";

/** Open leads by current stage, as of AS_OF. */
export function PipelineCard({ stages, asOf }: { stages: PipelineStage[]; asOf: string }) {
  return (
    <SectionCard
      title="Open pipeline by stage"
      description={`As of ${formatDate(asOf)} · not affected by the date filter`}
      help={METRIC_HELP.openPipeline}
    >
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stages.map((s) => (
          <div key={s.stage} className="rounded-lg bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">{STAGE_LABELS[s.stage]}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(s.count)}</dd>
            <dd className="text-xs text-muted-foreground tabular-nums">{s.count ? formatINR(s.value) : "—"}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
