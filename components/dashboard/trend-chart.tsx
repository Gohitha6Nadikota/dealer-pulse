"use client";

import { useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TrendPoint } from "@/lib/analytics/trend";
import {
  EMPTY,
  formatChange,
  formatDays,
  formatINR,
  formatMonth,
  formatMonthShort,
  formatNumber,
  formatPercent,
} from "@/lib/format";

type Point = TrendPoint & { inRange: boolean };
type Metric = "units" | "revenue";
const ACTIVE = "px-3 data-[state=on]:bg-sidebar-accent data-[state=on]:text-sidebar-accent-foreground";

const config = {
  booked: { label: "Booked", color: "var(--chart-1)" },
  target: { label: "Target", color: "var(--chart-2)" },
} satisfies ChartConfig;

const SERIES: Record<Metric, { booked: keyof Point; target: keyof Point; format: (n: number) => string }> = {
  units: { booked: "bookedUnits", target: "targetUnits", format: (n) => formatNumber(n) },
  revenue: { booked: "bookedRevenue", target: "targetRevenue", format: (n) => formatINR(n) },
};

/** Monthly bookings as columns with the target as a line, on one shared axis. */
export function TrendChart({ data }: { data: Point[] }) {
  const [metric, setMetric] = useState<Metric>("units");
  const [showTarget, setShowTarget] = useState(true);
  const series = SERIES[metric];
  const hasTarget = data.some((p) => p[series.target] !== null);
  const someOutOfRange = data.some((p) => !p.inRange);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-chart-1" />
            Booked
          </li>
          {hasTarget && showTarget && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-3.5 rounded-full bg-chart-2" />
              Target
            </li>
          )}
          {someOutOfRange && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-[3px] bg-chart-1/35" />
              Outside selected range
            </li>
          )}
        </ul>
        <div className="flex items-center gap-2">
          {hasTarget && (
            <Toggle
              size="sm"
              variant="outline"
              pressed={showTarget}
              onPressedChange={setShowTarget}
              aria-label="Show target line"
              className={ACTIVE}
            >
              Target
            </Toggle>
          )}
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            spacing={0}
            value={metric}
            onValueChange={(v) => v && setMetric(v as Metric)}
            aria-label="Measure"
          >
            <ToggleGroupItem value="units" className={ACTIVE}>Units</ToggleGroupItem>
            <ToggleGroupItem value="revenue" className={ACTIVE}>Revenue</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <ChartContainer config={config} className="aspect-auto h-64 w-full md:h-72">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonthShort}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tickMargin={8}
          />
          <YAxis
            allowDecimals={false}
            tickFormatter={(v: number) => series.format(v)}
            tickLine={false}
            axisLine={false}
            width={metric === "revenue" ? 64 : 36}
            className="tabular-nums"
          />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={<TrendTooltip metric={metric} />} />
          <Bar dataKey={series.booked} name="Booked" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((p) => (
              <Cell key={p.month} fill="var(--color-booked)" fillOpacity={p.inRange ? 1 : 0.35} />
            ))}
          </Bar>
          {hasTarget && showTarget && (
            <Line
              dataKey={series.target}
              name="Target"
              type="linear"
              stroke="var(--color-target)"
              strokeWidth={2}
              dot={{ r: 4, fill: "var(--color-target)", stroke: "var(--card)", strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ChartContainer>

      <details className="group text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          View as table
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead className="text-muted-foreground">
              <tr className="border-b text-left">
                <th className="py-1.5 pr-3 font-medium">Month</th>
                <th className="py-1.5 pr-3 text-right font-medium">Units</th>
                <th className="py-1.5 pr-3 text-right font-medium">Target</th>
                <th className="py-1.5 pr-3 text-right font-medium">Attainment</th>
                <th className="py-1.5 pr-3 text-right font-medium">Revenue</th>
                <th className="py-1.5 text-right font-medium">Avg delivery</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.month} className="border-b last:border-0">
                  <td className="py-1.5 pr-3">{formatMonth(p.month)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatNumber(p.bookedUnits)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatNumber(p.targetUnits)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatPercent(p.unitAttainment)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatINR(p.bookedRevenue)}</td>
                  <td className="py-1.5 text-right">{formatDays(p.avgDaysToDeliver)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function TrendTooltip({
  metric,
  active,
  payload,
}: {
  metric: Metric;
  active?: boolean;
  payload?: { payload: Point }[];
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const units = metric === "units";
  const booked = units ? formatNumber(p.bookedUnits) : formatINR(p.bookedRevenue);
  const target = units ? p.targetUnits : p.targetRevenue;
  const attainment = units ? p.unitAttainment : p.revenueAttainment;
  const censored = p.deliveryCompleteness !== null && p.deliveryCompleteness < 1;
  return (
    <div className="min-w-48 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium">{formatMonth(p.month)}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
        <dt className="text-muted-foreground">Booked</dt>
        <dd className="text-right font-medium">{booked}</dd>
        {target !== null && (
          <>
            <dt className="text-muted-foreground">Target</dt>
            <dd className="text-right">{units ? formatNumber(target) : formatINR(target)}</dd>
            <dt className="text-muted-foreground">Attainment</dt>
            <dd className="text-right">{formatPercent(attainment)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Units vs prior month</dt>
        <dd className="text-right">{p.bookedUnitsChange === null ? EMPTY : formatChange(p.bookedUnitsChange)}</dd>
        <dt className="text-muted-foreground">Avg delivery</dt>
        <dd className="text-right">
          {formatDays(p.avgDaysToDeliver)}
          {censored && "*"}
        </dd>
      </dl>
      {censored && (
        <p className="mt-1.5 max-w-52 text-[11px] leading-snug text-muted-foreground">
          * {formatPercent(p.deliveryCompleteness)} of this month&apos;s orders delivered so far; the rest
          will raise the average.
        </p>
      )}
    </div>
  );
}
