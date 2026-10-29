"use client";

import { RotateCcwIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS } from "@/lib/analytics/definitions";
import {
  NO_ADJUSTMENTS,
  STEP_ADJUSTMENT_RANGE,
  VOLUME_ADJUSTMENT_RANGE,
  runScenario,
  type Adjustments,
  type ScenarioInputs,
} from "@/lib/analytics/scenario";
import { formatChange, formatINR, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const pct = (d: number) => Math.round(d * 100);

/**
 * Sliders for each funnel step and lead volume; the effect is recalculated in
 * the browser with the same pure functions the server tests.
 */
export function WhatIfPanel({ inputs }: { inputs: ScenarioInputs }) {
  const [adjustments, setAdjustments] = useState<Adjustments>(NO_ADJUSTMENTS);
  const [includeConflicts, setIncludeConflicts] = useState(true);
  const [presetId, setPresetId] = useState<string | null>(null);
  const preset = inputs.presets.find((p) => p.id === presetId) ?? null;
  const conflicts = inputs.open.filter((o) => o.conflict).length;

  const base = runScenario(inputs, NO_ADJUSTMENTS, { includeConflicts });
  const scenario = runScenario(inputs, adjustments, { includeConflicts });
  const changed = adjustments.volume !== 0 || adjustments.steps.some((d) => d !== 0);

  const setStep = (i: number, value: number) => {
    setPresetId(null);
    setAdjustments((a) => ({ ...a, steps: a.steps.map((d, j) => (j === i ? value : d)) }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {inputs.presets.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              size="sm"
              aria-pressed={presetId === p.id}
              onClick={() => {
                setPresetId(p.id);
                setAdjustments(p.adjustments);
              }}
            >
              {p.label}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            disabled={!changed}
            onClick={() => {
              setPresetId(null);
              setAdjustments(NO_ADJUSTMENTS);
            }}
          >
            <RotateCcwIcon aria-hidden />
            Reset to today
          </Button>
        </div>
        {preset && <p className="-mt-2 text-xs text-muted-foreground">{preset.description}</p>}

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-sm font-medium">Step conversion</legend>
          {inputs.steps.map((step, i) => (
            <Lever
              key={step.from}
              label={`${STAGE_LABELS[step.from]} → ${STAGE_LABELS[step.to]}`}
              value={adjustments.steps[i]}
              min={STEP_ADJUSTMENT_RANGE.min}
              max={STEP_ADJUSTMENT_RANGE.max}
              onChange={(v) => setStep(i, v)}
              disabled={step.rate === null}
              today={formatPercent(step.rate)}
              scenario={formatPercent(scenario.rates[i])}
              note={step.source === "own" ? undefined : step.source === "company" ? "company rate" : "partly company rate"}
              capped={scenario.rates[i] === 1 && step.rate !== null && step.rate * (1 + adjustments.steps[i]) > 1}
            />
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">Lead volume</legend>
          <Lever
            label="New leads per month"
            value={adjustments.volume}
            min={VOLUME_ADJUSTMENT_RANGE.min}
            max={VOLUME_ADJUSTMENT_RANGE.max}
            onChange={(v) => setAdjustments((a) => ({ ...a, volume: v }))}
            today={formatNumber(Math.round(inputs.monthlyVolume))}
            scenario={formatNumber(Math.round(scenario.monthlyLeads))}
          />
        </fieldset>

        {conflicts > 0 && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 accent-[var(--primary)]"
              checked={includeConflicts}
              onChange={(e) => setIncludeConflicts(e.target.checked)}
            />
            <span>
              Include the {formatNumber(conflicts)} open {conflicts === 1 ? "lead" : "leads"} stored as lost
              <span className="block text-xs text-muted-foreground">Status conflicts: treated as open, but unverified.</span>
            </span>
          </label>
        )}
      </div>

      <div className="flex flex-col gap-3" aria-live="polite">
        <Effect
          label="Lead-to-order rate"
          today={formatPercent(base.leadToOrder, 1)}
          scenario={formatPercent(scenario.leadToOrder, 1)}
          delta={points(scenario.leadToOrder, base.leadToOrder)}
          up={(scenario.leadToOrder ?? 0) - (base.leadToOrder ?? 0)}
          detail="Chance a new lead ends in an order"
        />
        <Effect
          label="Orders from today's open pipeline"
          today={`~${base.pipeline.expectedOrders.toFixed(1)}`}
          scenario={`~${scenario.pipeline.expectedOrders.toFixed(1)}`}
          delta={signed(scenario.pipeline.expectedOrders - base.pipeline.expectedOrders, (n) => n.toFixed(1))}
          up={scenario.pipeline.expectedOrders - base.pipeline.expectedOrders}
          detail={`~90% range ${scenario.pipeline.ordersRange[0]}–${scenario.pipeline.ordersRange[1]} of ${formatNumber(scenario.pipeline.openLeads)} open leads; booked value ~${formatINR(scenario.pipeline.expectedValue)}`}
        />
        <Effect
          label="Orders per month from new leads"
          today={base.monthlyOrders === null ? "—" : `~${base.monthlyOrders.toFixed(1)}`}
          scenario={scenario.monthlyOrders === null ? "—" : `~${scenario.monthlyOrders.toFixed(1)}`}
          delta={
            scenario.monthlyOrders === null || base.monthlyOrders === null
              ? null
              : signed(scenario.monthlyOrders - base.monthlyOrders, (n) => n.toFixed(1))
          }
          up={(scenario.monthlyOrders ?? 0) - (base.monthlyOrders ?? 0)}
          detail={`At ${formatNumber(Math.round(scenario.monthlyLeads))} new leads a month`}
        />
        <Effect
          label="Booked revenue per month from new leads"
          today={base.monthlyRevenue === null ? "—" : formatINR(base.monthlyRevenue)}
          scenario={scenario.monthlyRevenue === null ? "—" : formatINR(scenario.monthlyRevenue)}
          delta={
            scenario.monthlyRevenue === null || base.monthlyRevenue === null
              ? null
              : signed(scenario.monthlyRevenue - base.monthlyRevenue, (n) => formatINR(n))
          }
          up={(scenario.monthlyRevenue ?? 0) - (base.monthlyRevenue ?? 0)}
          detail={inputs.avgDealValue === null ? "No booked deals to size revenue" : `At an average booked deal of ${formatINR(inputs.avgDealValue)}`}
        />
        {changed && base.leadToOrder !== null && scenario.leadToOrder !== null && (
          <p className="text-xs text-muted-foreground">
            Overall the lead-to-order rate changes by {formatChange(scenario.leadToOrder / base.leadToOrder - 1)} relative to today.
          </p>
        )}
      </div>
    </div>
  );
}

function signed(n: number, format: (n: number) => string): string {
  if (Math.abs(n) < 1e-9) return "no change";
  return `${n > 0 ? "+" : "−"}${format(Math.abs(n))}`;
}

function points(a: number | null, b: number | null): string | null {
  if (a === null || b === null) return null;
  const d = (a - b) * 100;
  return Math.abs(d) < 0.05 ? "no change" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)} pts`;
}

function Lever({
  label,
  value,
  min,
  max,
  onChange,
  today,
  scenario,
  note,
  disabled = false,
  capped = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  today: string;
  scenario: string;
  note?: string;
  disabled?: boolean;
  capped?: boolean;
}) {
  const id = useId();
  const change = pct(value);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
        <label htmlFor={id} className="font-medium">
          {label}
          {note && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({note})</span>}
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {today}
          {change !== 0 && (
            <>
              {" → "}
              <span className="font-medium text-foreground">{scenario}</span>
            </>
          )}
          <span
            className={cn(
              "ml-2 inline-block min-w-12 rounded px-1.5 py-0.5 text-center font-medium",
              change > 0 && "bg-good-surface text-good-foreground",
              change < 0 && "bg-critical-surface text-critical-foreground",
              change === 0 && "bg-muted",
            )}
          >
            {change > 0 ? "+" : change < 0 ? "−" : ""}
            {Math.abs(change)}%
          </span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={pct(min)}
        max={pct(max)}
        step={1}
        value={change}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-valuetext={`${change > 0 ? "+" : ""}${change}%, ${today} to ${scenario}`}
        className="w-full accent-[var(--primary)] disabled:opacity-50"
      />
      {capped && <span className="text-[11px] text-muted-foreground">Capped at 100%</span>}
    </div>
  );
}

function Effect({
  label,
  today,
  scenario,
  delta,
  up,
  detail,
}: {
  label: string;
  today: string;
  scenario: string;
  delta: string | null;
  up: number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 tabular-nums">
        {today !== scenario && (
          <>
            <span className="text-sm text-muted-foreground">{today}</span>
            <span aria-hidden className="text-muted-foreground">→</span>
            <span className="sr-only">with the changes:</span>
          </>
        )}
        <span className="text-xl font-semibold">{scenario}</span>
        {delta && delta !== "no change" && (
          <span className={cn("text-sm font-medium", up > 0 ? "text-good-foreground" : up < 0 ? "text-critical-foreground" : "")}>
            {delta}
          </span>
        )}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
