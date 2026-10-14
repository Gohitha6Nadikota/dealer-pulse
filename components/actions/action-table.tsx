"use client";

import Link from "next/link";
import { useState } from "react";
import { SeverityBadge } from "@/components/actions/severity-badge";
import { LeadTimelineSheet } from "@/components/leads/lead-timeline-sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { REASON_ACTIONS, REASON_LABELS } from "@/lib/action-params";
import type { ActionItem } from "@/lib/analytics/action-center";
import { hrefWithFilters, type Filters } from "@/lib/filters";
import { formatINR, formatNumber } from "@/lib/format";

/** Action items, most urgent first. Each lead appears once with all its reasons. */
export function ActionTable({ items, filters }: { items: ActionItem[]; filters: Filters }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((i) => i.leadId === selectedId)?.lead ?? null;
  const scoped = { ...filters, branchId: null };

  return (
    <>
      <Table className="min-w-[900px] tabular-nums">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Severity</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead>Why</TableHead>
            <TableHead>Owner · next step</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead className="text-right">Days</TableHead>
            <TableHead className="text-right">Deal value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.leadId} className="align-top">
              <TableCell className="pl-4">
                <SeverityBadge severity={item.severity} />
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.leadId)}
                  className="text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                  aria-label={`Open timeline for ${item.lead.customer}`}
                >
                  {item.lead.customer}
                </button>
                <span className="block text-xs text-muted-foreground">
                  {item.lead.model} · {item.leadId}
                </span>
                {item.owner.id !== item.rep.id && (
                  <span className="block text-xs text-muted-foreground">
                    Officer:{" "}
                    <Link href={hrefWithFilters(`/reps/${item.rep.id}`, scoped)} className="hover:underline">
                      {item.rep.name}
                    </Link>
                  </span>
                )}
              </TableCell>
              <TableCell className="max-w-72 whitespace-normal">
                <ul className="space-y-1">
                  {item.reasons.map((r, i) => (
                    <li key={r.reason} className="text-xs">
                      <span className={i === 0 ? "font-medium text-foreground" : "text-muted-foreground"}>
                        {REASON_LABELS[r.reason]}
                      </span>
                      <span className="text-muted-foreground"> · {r.detail}</span>
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell className="whitespace-normal">
                {item.owner.role === "sales_officer" ? (
                  <Link href={hrefWithFilters(`/reps/${item.owner.id}`, scoped)} className="font-medium hover:underline">
                    {item.owner.name}
                  </Link>
                ) : (
                  <span className="font-medium whitespace-nowrap">
                    {item.owner.name} <span className="font-normal text-muted-foreground">(manager)</span>
                  </span>
                )}
                <span className="block text-xs text-primary">{REASON_ACTIONS[item.primary]}</span>
              </TableCell>
              <TableCell>
                <Link href={hrefWithFilters(`/branches/${item.branch.id}`, scoped)} className="hover:underline">
                  {item.branch.name}
                </Link>
              </TableCell>
              <TableCell className="text-right">{formatNumber(item.days)}</TableCell>
              <TableCell className="text-right font-medium">{formatINR(item.dealValue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <LeadTimelineSheet lead={selected} onOpenChange={(open) => !open && setSelectedId(null)} />
    </>
  );
}
