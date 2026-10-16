"use client";

import { useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TrendPoint } from "@/lib/analytics/trend";
import { defaultTrendMetric, trendScale, type TrendMetric } from "@/lib/analytics/trend-scale";
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
const ACTIVE = "px-3 data-[state=on]:bg-sidebar-accent data-[state=on]:text-sidebar-accent-foreground";

const config = {
  booked: { label: "Booked", color: "var(--chart-1)" },
  target: { label: "Target", color: "var(--chart-2)" },
} satisfies ChartConfig;

const SERIES: Record<
  TrendMetric,
  { booked: keyof Point; target: keyof Point | null; format: (n: number) => string; label: string }
> = {
  attainment: { booked: "unitAttainment", target: null, format: (n) => formatPercent(n), label: "Attainment" },
  units: { booked: "bookedUnits", target: "targetUnits", format: (n) => formatNumber(n), label: "Booked units" },
  revenue: { booked: "bookedRevenue", target: "targetRevenue", format: (n) => formatINR(n), label: "Booked revenue" },
};

function rangeText(min: number, max: number, format: (n: number) => string): string {
  return min === max ? format(min) : `${format(min)}–${format(max)}`;
}

/**
 * Monthly bookings. Opens on attainment (booked ÷ target units) when the scope
 * has targets. The y-axis is capped near 1.5× the largest bar so the target,
 * which runs far above actual volume, never flattens the bars; an off-scale
 * target is labelled with its value instead of drawn.
 */
export function TrendChart({ data }: { data: Point[] }) {
  const [metric, setMetric] = useState<TrendMetric>(() => defaultTrendMetric(data));
  const [showTarget, setShowTarget] = useState(true);
  const series = SERIES[metric];
  const scale = trendScale(data, metric);
  const target = scale.target;
  const hasAttainment = data.some((p) => p.unitAttainment !== null);
  const drawTarget = target !== null && !target.offScale && showTarget;
  // One decimal on the percent axis only when a tick needs it (e.g. 2.5%).
  const pctDigits = scale.ticks.some((t) => Math.round(t * 1000) % 10 !== 0) ? 1 : 0;
  const someOutOfRange = data.some((p) => !p.inRange);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-chart-1" />
            {series.label}
          </li>
          {target && target.offScale && (
            <li className="flex items-center gap-1.5 font-medium text-foreground">
              <span aria-hidden className="h-0.5 w-3.5 rounded-full border-t-2 border-dashed border-chart-2" />
              Target off-scale: {rangeText(target.min, target.max, series.format)}
              {metric !== "attainment" && " per month"}
            </li>
          )}
          {drawTarget && (
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
          {target && !target.offScale && (
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
            onValueChange={(v) => v && setMetric(v as TrendMetric)}
            aria-label="Measure"
          >
            {hasAttainment && (
              <ToggleGroupItem value="attainment" className={ACTIVE}>
                Attainment %
              </ToggleGroupItem>
            )}
            <ToggleGroupItem value="units" className={ACTIVE}>
              Units
            </ToggleGroupItem>
            <ToggleGroupItem value="revenue" className={ACTIVE}>
              Revenue
            </ToggleGroupItem>
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
            domain={[0, scale.max]}
            ticks={scale.ticks}
            allowDataOverflow
            allowDecimals={metric === "attainment"}
            tickFormatter={(v: number) => (metric === "attainment" ? formatPercent(v, pctDigits) : series.format(v))}
            tickLine={false}
            axisLine={false}
            width={metric === "revenue" ? 64 : 44}
            className="tabular-nums"
          />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={<TrendTooltip metric={metric} />} />
          <Bar dataKey={series.booked} name={series.label} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((p) => (
              <Cell key={p.month} fill="var(--color-booked)" fillOpacity={p.inRange ? 1 : 0.35} />
            ))}
          </Bar>
          {drawTarget && metric === "attainment" && (
            <ReferenceLine y={1} stroke="var(--color-target)" strokeWidth={2} ifOverflow="hidden" />
          )}
          {drawTarget && series.target && (
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
  metric: TrendMetric;
  active?: boolean;
  payload?: { payload: Point }[];
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const units = metric !== "revenue";
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
