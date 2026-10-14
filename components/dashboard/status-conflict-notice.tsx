import { ArrowRightIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import type { StatusConflictNotice as Notice } from "@/lib/analytics/status-conflicts";
import { cn } from "@/lib/utils";

/**
 * Compact data-quality warning for CRM status conflicts. Renders nothing when
 * there is no notice. Independent of the date filter by design.
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
        "flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-surface p-4 text-warning-foreground sm:flex-row sm:items-start",
        className,
      )}
    >
      <TriangleAlertIcon className="size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <h2 id={titleId} className="text-sm font-semibold">
          {notice.title}
        </h2>
        <p className="text-sm text-pretty">{notice.body}</p>
        {notice.notes.map((note) => (
          <p key={note} className="text-sm font-medium text-pretty">
            {note}
          </p>
        ))}
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1 self-start rounded-md border border-warning/50 bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      >
        Review affected leads
        <ArrowRightIcon className="size-3.5" aria-hidden />
      </Link>
    </section>
  );
}
