"use client";

import { RotateCcwIcon, Loader2Icon } from "lucide-react";
import { useFilterNavigation } from "@/components/filters/filter-transition";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ACTION_REASONS,
  REASON_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  actionsHref,
  type ActionParams,
  type ActionReason,
  type Severity,
} from "@/lib/action-params";
import type { Filters } from "@/lib/filters";

const ALL = "all";
const ACTIVE = "px-2.5 data-[state=on]:bg-sidebar-accent data-[state=on]:text-sidebar-accent-foreground";

/** Action Center filters; every change is a URL change. Counts show results if chosen. */
export function ActionFilterBar({
  filters,
  params,
  branches,
  owners,
  facets,
}: {
  filters: Filters;
  params: ActionParams;
  branches: { id: string; name: string }[];
  owners: { id: string; name: string; role: string }[];
  facets: { reason: Record<ActionReason, number>; severity: Record<Severity, number> };
}) {
  const { pending, navigate } = useFilterNavigation();
  const go = (f: Partial<Filters>, p: Partial<ActionParams>) =>
    navigate(actionsHref({ ...filters, ...f }, { ...params, ...p }));
  const isDefault = !filters.branchId && !params.reason && !params.severity && !params.ownerId;

  return (
    <div role="group" aria-label="Action filters" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.branchId ?? ALL} onValueChange={(v) => go({ branchId: v === ALL ? null : v }, { ownerId: null })}>
          <SelectTrigger size="sm" aria-label="Branch" className="min-w-40 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All branches</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={params.ownerId ?? ALL} onValueChange={(v) => go({}, { ownerId: v === ALL ? null : v })}>
          <SelectTrigger size="sm" aria-label="Person" className="min-w-44 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Everyone</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
                {o.role === "branch_manager" ? " (manager)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={params.severity ?? ""}
          onValueChange={(v) => go({}, { severity: (v || null) as Severity | null })}
          aria-label="Severity"
          className="bg-card"
        >
          {SEVERITIES.map((s) => (
            <ToggleGroupItem key={s} value={s} className={ACTIVE}>
              {SEVERITY_LABELS[s]}
              <span className="ml-1 text-xs text-muted-foreground tabular-nums">{facets.severity[s]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {!isDefault && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => go({ branchId: null }, { reason: null, severity: null, ownerId: null })}
            className="text-muted-foreground"
          >
            <RotateCcwIcon aria-hidden />
            Reset
          </Button>
        )}
        <span role="status" aria-live="polite" className="inline-flex size-4 items-center">
          {pending && <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-label="Updating" />}
        </span>
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={params.reason ?? ""}
        onValueChange={(v) => go({}, { reason: (v || null) as ActionReason | null })}
        aria-label="Reason"
        className="flex-wrap bg-card"
      >
        {ACTION_REASONS.map((r) => (
          <ToggleGroupItem key={r} value={r} className={ACTIVE}>
            {REASON_LABELS[r]}
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">{facets.reason[r]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
