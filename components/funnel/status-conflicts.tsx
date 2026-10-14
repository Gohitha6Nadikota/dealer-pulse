import Link from "next/link";
import { LeadTable } from "@/components/leads/lead-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { actionsHref } from "@/lib/action-params";
import type { FunnelView } from "@/lib/analytics/funnel-view";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";

/** The leads stored as "lost" with no loss event: what we know, and how they're treated. */
export function StatusConflicts({ view }: { view: FunnelView }) {
  const sc = view.statusConflicts;
  if (!sc.leads.length) {
    return <p className="px-4 text-sm text-muted-foreground">No leads in this scope are stored as lost without a loss event.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 px-4 lg:grid-cols-2">
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">{formatNumber(sc.leads.length)} leads</span> have the status &ldquo;lost&rdquo;, but
            their history has no loss event and none has a loss reason. All were created between{" "}
            {sc.createdFrom && formatDate(sc.createdFrom)} and {sc.createdTo && formatDate(sc.createdTo)}, and none has been
            idle more than {formatNumber(sc.maxDaysIdle)} days. Their histories and latest notes suggest ongoing conversations, which still needs verifying (see below).
          </p>
          <p className="text-muted-foreground">
            They are treated as <span className="text-foreground">open at their last stage</span>: never counted as losses,
            shown as &ldquo;stored as lost&rdquo; wherever they appear, and listed in the{" "}
            <Link href={actionsHref({ ...view.filters, branchId: view.branch?.id ?? null }, { reason: "status_conflict" })} className="text-primary hover:underline">
              Action Center
            </Link>{" "}
            so the status can be corrected.
          </p>
          {sc.fullyAffected.map((b) => (
            <p key={b.branch.id} className="rounded-md bg-warning-surface p-3 text-warning-foreground">
              All {formatNumber(b.openLeads)} of {b.branch.name}&apos;s open leads are stored as lost. Its CRM statuses for
              in-progress leads can&apos;t be trusted until this is fixed.
            </p>
          ))}
        </div>
        <Table className="tabular-nums">
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead className="text-right">Stored as lost</TableHead>
              <TableHead className="text-right">Open leads</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sc.byBranch.map((b) => (
              <TableRow key={b.branch.id}>
                <TableCell>{b.branch.name}</TableCell>
                <TableCell className="text-right font-medium">{formatNumber(b.conflicts)}</TableCell>
                <TableCell className="text-right">{formatNumber(b.openLeads)}</TableCell>
                <TableCell className="text-right">{formatPercent(b.share)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <LeadTable rows={sc.leads} buckets={["open"]} defaultBucket="open" showRep />
    </div>
  );
}
