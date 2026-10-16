import { EmptyState } from "@/components/dashboard/empty-state";
import { SectionCard } from "@/components/dashboard/section-card";
import { LeadSources } from "@/components/segments/lead-sources";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MIN_SEGMENT_SAMPLE, SOURCE_SPREAD_POINTS, type Segments } from "@/lib/analytics/segments";
import { formatINR, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The scope a card describes: the company or one branch, for leads created in a period. */
export type SegmentScope = { name: string; period: string };

const WIN_RATE_HELP = `Win rate = won ÷ (won + genuinely lost) for leads created in the period. Leads stored as lost without a loss event count as open. Fewer than ${MIN_SEGMENT_SAMPLE} leads is flagged as too few to compare.`;

/** Donut of leads by source, with win rates and the source-field caveat. */
export function LeadSourcesCard({ segments, scope }: { segments: Segments; scope: SegmentScope }) {
  const { sources, agreement } = segments;
  return (
    <SectionCard
      title="Lead sources"
      description={`${scope.name} · leads created in ${scope.period}`}
      help={WIN_RATE_HELP}
    >
      {sources.length === 0 ? (
        <EmptyState title="No leads created in this period" className="py-8" />
      ) : (
        <div className="flex flex-col gap-3">
          <LeadSources rows={sources} colorIndex={segments.sourceColorIndex} />
          {segments.sourcesLookAlike && (
            <p className="text-xs text-muted-foreground">
              Source doesn&apos;t predict conversion here: win rates are within {SOURCE_SPREAD_POINTS} points of each other.
            </p>
          )}
          {agreement.share !== null && agreement.expectedIfUnrelated !== null && (
            <p className="text-xs text-warning-foreground">
              The source field matches the channel in the lead&apos;s first note for {formatPercent(agreement.share)} of
              leads, about what chance gives ({formatPercent(agreement.expectedIfUnrelated)}). Treat differences between
              sources with caution.
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/** Car models by booked revenue, with win rate and revenue share. */
export function CarModelsCard({ segments, scope }: { segments: Segments; scope: SegmentScope }) {
  const { models } = segments;
  return (
    <SectionCard
      title="Car models"
      description={`${scope.name} · leads created in ${scope.period}, highest booked revenue first`}
      help={WIN_RATE_HELP}
      contentClassName="px-0"
    >
      {models.length === 0 ? (
        <EmptyState title="No leads created in this period" className="mx-4 py-8" />
      ) : (
        <Table className="min-w-[620px] tabular-nums">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Model</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Booked</TableHead>
              <TableHead className="text-right">Win rate</TableHead>
              <TableHead className="text-right">Booked revenue</TableHead>
              <TableHead className="pr-4">Share of revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((m) => (
              <TableRow key={m.key}>
                <TableCell className="pl-4">
                  <span className="flex flex-wrap items-center gap-1.5 font-medium">
                    {m.label}
                    {m.small && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Fewer than {MIN_SEGMENT_SAMPLE}
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-right">{formatNumber(m.leads)}</TableCell>
                <TableCell className="text-right">{formatNumber(m.won)}</TableCell>
                <TableCell className={cn("text-right", m.small && "text-muted-foreground")}>{formatPercent(m.winRate)}</TableCell>
                <TableCell className="text-right font-medium">{formatINR(m.bookedRevenue)}</TableCell>
                <TableCell className="pr-4">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-16 shrink-0 rounded-full bg-muted" aria-hidden>
                      <span
                        className="block h-full rounded-full bg-chart-1"
                        style={{ width: `${Math.round((m.revenueShare ?? 0) * 100)}%` }}
                      />
                    </span>
                    {formatPercent(m.revenueShare)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}

/** Placeholder with the cards' shape while the page loads. */
export function SegmentCardSkeleton({ variant }: { variant: "donut" | "table" }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4" aria-hidden>
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-56" />
      {variant === "donut" ? (
        <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
          <Skeleton className="mx-auto aspect-square w-full max-w-[180px] rounded-full" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
