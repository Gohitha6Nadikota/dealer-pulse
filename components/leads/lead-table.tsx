"use client";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { LeadTimelineSheet } from "@/components/leads/lead-timeline-sheet";
import { StageBadge } from "@/components/leads/stage-badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import {
  BUCKET_LABELS,
  DEFAULT_SORT_DIR,
  bucketCounts,
  filterLeads,
  sortLeads,
  type LeadBucket,
  type LeadRow,
  type SortDir,
  type SortKey,
} from "@/lib/lead-table";
import { cn } from "@/lib/utils";

const ACTIVE = "px-3 data-[state=on]:bg-sidebar-accent data-[state=on]:text-sidebar-accent-foreground";

/** Searchable, sortable lead list; a row opens the lead's timeline. */
export function LeadTable({
  rows,
  buckets,
  defaultBucket,
  showRep = false,
}: {
  rows: LeadRow[];
  /** Status tabs to offer, in order. */
  buckets: (LeadBucket | "all")[];
  defaultBucket: LeadBucket | "all";
  showRep?: boolean;
}) {
  const [bucket, setBucket] = useState<LeadBucket | "all">(defaultBucket);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "idle", dir: "desc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(() => bucketCounts(rows), [rows]);
  const visible = useMemo(
    () => sortLeads(filterLeads(rows, { bucket, query }), sort.key, sort.dir),
    [rows, bucket, query, sort],
  );
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: DEFAULT_SORT_DIR[key] },
    );

  const header = (key: SortKey, label: string, align: "left" | "right" = "left") => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDownIcon : sort.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
    return (
      <TableHead
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        className={cn(align === "right" && "text-right", key === "customer" && "pl-4")}
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className={cn(
            "inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
            active ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
          <Icon className="size-3.5" aria-hidden />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={bucket}
          onValueChange={(v) => v && setBucket(v as LeadBucket | "all")}
          aria-label="Lead status"
          className="flex-wrap"
        >
          {buckets.map((b) => (
            <ToggleGroupItem key={b} value={b} className={ACTIVE}>
              {b === "all" ? "All" : BUCKET_LABELS[b]}
              <span className="ml-1 text-xs text-muted-foreground tabular-nums">{counts[b]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={showRep ? "Search customer, model, officer…" : "Search customer, model, ID…"}
            aria-label="Search leads"
            className="h-8 pl-8"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No leads match"
          description={query ? `Nothing matches “${query}” in this view.` : "There are no leads in this status."}
          className="mx-4"
        />
      ) : (
        <Table className="min-w-[820px] tabular-nums">
          <TableHeader>
            <TableRow>
              {header("customer", "Customer")}
              {showRep && <TableHead>Sales officer</TableHead>}
              {header("stage", "Stage")}
              {header("value", "Deal value", "right")}
              {header("idle", "Days idle", "right")}
              <TableHead>Last note</TableHead>
              {header("created", "Created")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedId(r.id)}>
                <TableCell className="pl-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(r.id);
                    }}
                    className="text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                    aria-label={`Open timeline for ${r.customer}`}
                  >
                    {r.customer}
                  </button>
                  <span className="block text-xs text-muted-foreground">
                    {r.model} · {r.id}
                  </span>
                </TableCell>
                {showRep && <TableCell>{r.rep.name}</TableCell>}
                <TableCell>
                  <StageBadge status={r.status} />
                  {r.statusConflict && (
                    <span className="mt-0.5 block text-[11px] text-warning-foreground">Stored as lost</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">{formatINR(r.dealValue)}</TableCell>
                <TableCell className={cn("text-right", r.stale && "font-medium text-warning-foreground")}>
                  {r.bucket === "open" ? formatNumber(r.daysIdle) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="max-w-64">
                  <span className="line-clamp-2 text-xs text-muted-foreground whitespace-normal">{r.lastNote || "—"}</span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="px-4 text-xs text-muted-foreground" role="status" aria-live="polite">
        Showing {formatNumber(visible.length)} of {formatNumber(bucket === "all" ? counts.all : counts[bucket])} leads
      </p>
      {visible.some((r) => r.statusConflict) && (
        <p className="px-4 text-xs text-warning-foreground">
          Stored as lost: excluded from genuine losses because no loss event or loss reason is recorded. Treated as open
          at the last stage until the CRM status is corrected.
        </p>
      )}

      <LeadTimelineSheet lead={selected} onOpenChange={(open) => !open && setSelectedId(null)} />
    </div>
  );
}
