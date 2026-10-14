import { InfoIcon } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { actionsHref, type ActionParams } from "@/lib/action-params";
import type { StatusConflictSummary } from "@/lib/analytics/status-conflicts";
import { hrefWithFilters, type Filters } from "@/lib/filters";
import { formatDate, formatNumber } from "@/lib/format";

/**
 * Shown on the Action Center when filtered to status conflicts: what is
 * inconsistent, how analytics treat it, why it needs fixing, and where.
 */
export function StatusConflictExplainer({
  summary,
  filters,
  params,
}: {
  summary: StatusConflictSummary;
  filters: Filters;
  params: ActionParams;
}) {
  const titleId = useId();
  if (summary.count === 0) return null;
  const affected = summary.byBranch.filter((b) => b.conflicts > 0);
  return (
    <section aria-labelledby={titleId} className="rounded-xl border bg-card p-4">
      <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold">
        <InfoIcon className="size-4 text-warning-foreground" aria-hidden />
        About these {formatNumber(summary.count)} status conflicts
      </h2>
      <div className="mt-3 grid gap-4 text-sm lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <dl className="space-y-2.5">
          <div>
            <dt className="font-medium">What is inconsistent</dt>
            <dd className="text-muted-foreground">
              The CRM stores these leads as lost, but their history has no loss event and no loss reason. All were created
              between {summary.createdFrom && formatDate(summary.createdFrom)} and{" "}
              {summary.createdTo && formatDate(summary.createdTo)} (UTC), and none has been idle more than{" "}
              {formatNumber(summary.maxDaysIdle)} days.
            </dd>
          </div>
          <div>
            <dt className="font-medium">How DealerPulse treats them</dt>
            <dd className="text-muted-foreground">
              As open at their last recorded stage. They are excluded from genuine losses, loss rates and loss reasons, and
              labelled &ldquo;stored as lost&rdquo; wherever they appear, so no loss is reported without evidence.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Why they need review</dt>
            <dd className="text-muted-foreground">
              Their histories and latest notes suggest ongoing conversations, but that has not been verified. Confirm with
              the sales officer, then correct the CRM status: the actual stage, or lost with a reason. Until then, pipeline
              and outlook figures that include them carry extra uncertainty (see{" "}
              <Link href={hrefWithFilters("/funnel", filters)} className="text-primary hover:underline">
                Funnel &amp; outlook
              </Link>
              ).
            </dd>
          </div>
        </dl>
        <div>
          <h3 className="font-medium">Affected branches</h3>
          <ul className="mt-2 space-y-1.5">
            {affected.map((b) => (
              <li key={b.branch.id} className="flex items-baseline justify-between gap-2">
                <Link
                  href={actionsHref({ ...filters, branchId: b.branch.id }, { ...params, ownerId: null })}
                  className="truncate hover:underline"
                >
                  {b.branch.name}
                </Link>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatNumber(b.conflicts)} of {formatNumber(b.openLeads)} open
                </span>
              </li>
            ))}
          </ul>
          {summary.fullyAffected.map((b) => (
            <p key={b.branch.id} className="mt-2 rounded-md bg-warning-surface p-2 text-xs text-warning-foreground">
              All of {b.branch.name}&apos;s open leads are affected; treat its in-progress CRM statuses with caution until
              they are corrected.
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
