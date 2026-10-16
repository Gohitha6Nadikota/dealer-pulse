"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { SegmentRow } from "@/lib/analytics/segments";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const SERIES = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5", "--series-6"];
const config = {} satisfies ChartConfig;

function color(index: number | undefined): string {
  return index !== undefined && index < SERIES.length ? `var(${SERIES[index]})` : "var(--series-other)";
}

function SmallFlag() {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-muted-foreground">
      Fewer than 20
    </span>
  );
}

/** Donut of leads by source with a legend (count, win rate) and a table view. */
export function LeadSources({ rows, colorIndex }: { rows: SegmentRow[]; colorIndex: Record<string, number> }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const total = rows.reduce((n, r) => n + r.leads, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          aria-pressed={view === "table"}
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {view === "chart" ? "View as table" : "View as chart"}
        </button>
      </div>

      {view === "chart" ? (
        <div className="grid max-w-2xl items-center gap-4 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] sm:gap-8">
          <div className="relative mx-auto aspect-square w-full max-w-[180px]">
            <ChartContainer config={config} className="aspect-square w-full">
              <PieChart>
                <Tooltip content={<SourceTooltip />} />
                <Pie
                  data={rows}
                  dataKey="leads"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="100%"
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {rows.map((r) => (
                    <Cell key={r.key} fill={color(colorIndex[r.key])} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tabular-nums">{formatNumber(total)}</span>
              <span className="text-[11px] text-muted-foreground">leads</span>
            </div>
          </div>
          <ul className="flex min-w-0 flex-col gap-1.5 text-sm" aria-label="Lead sources">
            {rows.map((r) => (
              <li key={r.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2">
                <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: color(colorIndex[r.key]) }} />
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="truncate">{r.label}</span>
                  {r.small && <SmallFlag />}
                </span>
                <span className="text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  <span className="font-medium text-foreground">{formatNumber(r.leads)}</span> leads ·{" "}
                  {formatPercent(r.winRate)} win
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b text-left">
                <th className="py-1.5 pr-3 font-medium">Source</th>
                <th className="py-1.5 pr-3 text-right font-medium">Leads</th>
                <th className="py-1.5 pr-3 text-right font-medium">Share</th>
                <th className="py-1.5 pr-3 text-right font-medium">Won</th>
                <th className="py-1.5 pr-3 text-right font-medium">Lost</th>
                <th className="py-1.5 pr-3 text-right font-medium">Open</th>
                <th className="py-1.5 text-right font-medium">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="py-1.5 pr-3">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {r.label}
                      {r.small && <SmallFlag />}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right">{formatNumber(r.leads)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatPercent(r.leadShare)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatNumber(r.won)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatNumber(r.lost)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatNumber(r.open)}</td>
                  <td className={cn("py-1.5 text-right", r.small && "text-muted-foreground")}>{formatPercent(r.winRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SourceTooltip({ active, payload }: { active?: boolean; payload?: { payload: SegmentRow }[] }) {
  const r = payload?.[0]?.payload;
  if (!active || !r) return null;
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium">{r.label}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
        <dt className="text-muted-foreground">Leads</dt>
        <dd className="text-right font-medium">
          {formatNumber(r.leads)} ({formatPercent(r.leadShare)})
        </dd>
        <dt className="text-muted-foreground">Won · lost · open</dt>
        <dd className="text-right">
          {formatNumber(r.won)} · {formatNumber(r.lost)} · {formatNumber(r.open)}
        </dd>
        <dt className="text-muted-foreground">Win rate</dt>
        <dd className="text-right">{formatPercent(r.winRate)}</dd>
      </dl>
      {r.small && <p className="mt-1.5 text-[11px] text-muted-foreground">Fewer than 20 leads: too few to compare.</p>}
    </div>
  );
}
