import { ArrowRightIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import type { StatusConflictNotice as Notice } from "@/lib/analytics/status-conflicts";
import { cn } from "@/lib/utils";

/**
 * Compact data-quality strip for CRM status conflicts, placed under the
 * headline insight. Renders nothing when there is no notice. Independent of
 * the date filter by design.
 */
export function StatusConflictNotice({
  notice,
  href,
  className,
}: {
  notice: Notice | null;
  /** Action Center link filtered to status conflicts. */
  href: string;
  className?: string;
}) {
  const titleId = useId();
  if (!notice) return null;
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-warning/40 bg-warning-surface px-3 py-2 text-sm text-warning-foreground sm:flex-row sm:items-center sm:gap-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 text-pretty">
          <span className="font-semibold">
            <h2 id={titleId} className="inline text-sm font-semibold">
              {notice.title}
            </h2>
            .
          </span>{" "}
          {notice.body}
          {notice.notes.length > 0 && <span className="font-medium"> {notice.notes.join(" ")}</span>}
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1 self-start rounded-sm pl-6 font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring sm:self-center sm:pl-0"
      >
        Review affected leads
        <ArrowRightIcon className="size-3.5" aria-hidden />
      </Link>
    </section>
  );
}
