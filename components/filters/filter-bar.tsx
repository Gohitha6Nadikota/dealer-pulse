"use client";

import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { useFilterNavigation } from "@/components/filters/filter-transition";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DEFAULT_PRESET,
  RANGE_PRESETS,
  hrefWithFilters,
  presetRange,
  type Filters,
  type RangePreset,
} from "@/lib/filters";
import { formatMonth } from "@/lib/format";

const ALL_BRANCHES = "all";
const ACTIVE = "px-3 data-[state=on]:bg-sidebar-accent data-[state=on]:text-sidebar-accent-foreground";

/** Global filters. Every change is a URL change, so views are shareable. */
export function FilterBar({
  path,
  filters,
  months,
  branches,
}: {
  path: string;
  filters: Filters;
  months: string[];
  /** Omit on pages already scoped by path (branch or officer pages). */
  branches?: { id: string; name: string }[];
}) {
  const { pending, navigate } = useFilterNavigation();
  const go = (changes: Partial<Filters>) => navigate(hrefWithFilters(path, filters, changes));

  const setPreset = (value: string) => {
    if (!value) return; // ToggleGroup sends "" when the active item is clicked again
    const preset = value as RangePreset;
    if (preset === "custom") go({ preset, range: filters.range });
    else go({ preset, range: presetRange(preset, months) });
  };

  const setMonth = (edge: "from" | "to", month: string) => {
    const range = { ...filters.range, [edge]: month };
    if (range.from > range.to) {
      if (edge === "from") range.to = month;
      else range.from = month;
    }
    go({ preset: "custom", range });
  };

  const isDefault = filters.preset === DEFAULT_PRESET && filters.branchId === null;

  return (
    <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={filters.preset}
        onValueChange={setPreset}
        aria-label="Time range"
        className="bg-card"
      >
        {RANGE_PRESETS.map((p) => (
          <ToggleGroupItem key={p.id} value={p.id} className={ACTIVE}>
            {p.label}
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem value="custom" className={ACTIVE}>
          Custom
        </ToggleGroupItem>
      </ToggleGroup>

      {filters.preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <MonthSelect label="From" value={filters.range.from} months={months} onChange={(m) => setMonth("from", m)} />
          <span className="text-sm text-muted-foreground">to</span>
          <MonthSelect label="To" value={filters.range.to} months={months} onChange={(m) => setMonth("to", m)} />
        </div>
      )}

      {branches && (
        <Select
          value={filters.branchId ?? ALL_BRANCHES}
          onValueChange={(v) => go({ branchId: v === ALL_BRANCHES ? null : v })}
        >
          <SelectTrigger size="sm" aria-label="Branch" className="min-w-40 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_BRANCHES}>All branches</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {!isDefault && (
        <Button variant="ghost" size="sm" onClick={() => navigate(path)} className="text-muted-foreground">
          <RotateCcwIcon aria-hidden />
          Reset
        </Button>
      )}
      <span role="status" aria-live="polite" className="inline-flex size-4 items-center">
        {pending && <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-label="Updating" />}
      </span>
    </div>
  );
}

function MonthSelect({
  label,
  value,
  months,
  onChange,
}: {
  label: string;
  value: string;
  months: string[];
  onChange: (month: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={`${label} month`} className="bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {months.map((m) => (
          <SelectItem key={m} value={m}>
            {formatMonth(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
