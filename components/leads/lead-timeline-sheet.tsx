"use client";

import { AlertTriangleIcon } from "lucide-react";
import { StageBadge } from "@/components/leads/stage-badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { STAGE_LABELS } from "@/lib/analytics/definitions";
import { formatDate, formatDays, formatINR, humanize } from "@/lib/format";
import type { LeadRow } from "@/lib/lead-table";

const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/** Side drawer with one lead's facts and its full status history. */
export function LeadTimelineSheet({
  lead,
  onOpenChange,
}: {
  lead: LeadRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={lead !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {lead && (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-lg">{lead.customer}</SheetTitle>
                <StageBadge status={lead.status} />
              </div>
              <SheetDescription>
                {lead.model} · {formatINR(lead.dealValue)} · {lead.rep.name}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-5 p-4">
              {lead.dataQualityIssue === "status_lost_without_event" && (
                <p className="flex gap-2 rounded-md bg-warning-surface p-3 text-xs text-warning-foreground">
                  <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Recorded as lost, but its history has no loss event or reason. Treated as open at its last stage.
                </p>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Fact label="Lead ID" value={lead.id} />
                <Fact label="Source" value={humanize(lead.source)} />
                <Fact label="Created" value={formatDate(lead.createdAt)} />
                <Fact label="Last activity" value={formatDate(lead.lastActivityAt)} />
                {lead.bucket === "open" && <Fact label="Days idle" value={formatDays(lead.daysIdle, 0)} />}
                {lead.bucket === "awaiting" && <Fact label="Waiting for delivery" value={formatDays(lead.daysInStage, 0)} />}
                {lead.lostReason && <Fact label="Loss reason" value={lead.lostReason} />}
                {lead.delivery && (
                  <>
                    <Fact label="Days to deliver" value={formatDays(lead.delivery.daysToDeliver, 0)} />
                    {lead.delivery.delayReason && <Fact label="Delay reason" value={lead.delivery.delayReason} />}
                  </>
                )}
              </dl>
              <section aria-label="Status history">
                <h3 className="mb-3 text-sm font-medium">Timeline</h3>
                <ol className="relative flex flex-col gap-4 border-l pl-5">
                  {lead.history.map((event, i) => (
                    <li key={`${event.status}-${i}`} className="relative">
                      <span
                        aria-hidden
                        className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card bg-chart-1 ring-1 ring-border"
                      />
                      <p className="text-sm font-medium">{STAGE_LABELS[event.status]}</p>
                      <p className="text-xs text-muted-foreground">
                        <time dateTime={event.timestamp}>
                          {formatDate(event.timestamp)}, {timeFormat.format(new Date(event.timestamp))} UTC
                        </time>
                      </p>
                      {event.note && <p className="mt-1 text-sm text-muted-foreground">{event.note}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
