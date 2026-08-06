"use client";

import * as React from "react";
import type { TooltipProps } from "recharts";

import { cn } from "@/lib/utils";

/** The brand ramp, reused for every categorical series. */
export const CHART_COLORS = [
  "#8B5CF6",
  "#38BDF8",
  "#A855F7",
  "#22D3EE",
  "#F97316",
  "#22C55E",
  "#EC4899",
  "#F59E0B",
  "#6366F1",
  "#14B8A6",
  "#EF4444",
  "#A1A1AA",
];

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

type ChartTooltipProps = TooltipProps<number, string> & {
  formatValue?: (value: number) => string;
  /** Overrides the tooltip heading; defaults to the axis label. */
  labelFormatter?: (label: string) => string;
  hideLabel?: boolean;
};

/**
 * Shared tooltip for every chart — Recharts' default is styled for light
 * backgrounds and cannot be themed enough through props alone.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
  labelFormatter,
  hideLabel = false,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const rows = payload.filter((entry) => entry.value !== undefined && entry.value !== null);
  if (rows.length === 0) return null;

  return (
    <div className="pointer-events-none rounded-xl border border-white/[0.10] bg-surface/95 px-3 py-2.5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
      {!hideLabel && label ? (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-subtle">
          {labelFormatter ? labelFormatter(String(label)) : label}
        </p>
      ) : null}

      <div className="space-y-1.5">
        {rows.map((entry, index) => (
          <div
            key={`${entry.dataKey}-${index}`}
            className="flex items-center gap-2.5 text-xs"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{
                backgroundColor: entry.color ?? entry.payload?.fill ?? "#8B5CF6",
                boxShadow: `0 0 8px ${entry.color ?? "#8B5CF6"}80`,
              }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="tabular ml-auto font-semibold text-white">
              {formatValue
                ? formatValue(Number(entry.value))
                : Number(entry.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Compact legend, since Recharts' built-in one is hard to restyle. */
export function ChartLegend({
  items,
  className,
}: {
  items: { label: string; color: string; value?: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}66` }}
          />
          <span className="text-muted-foreground">{item.label}</span>
          {item.value ? (
            <span className="tabular font-medium text-white">{item.value}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Shown inside a chart card when there is genuinely nothing to plot. */
export function ChartEmpty({
  message = "No data for this period",
  height = 260,
}: {
  message?: string;
  height?: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 text-center"
      style={{ height }}
    >
      <div className="flex items-end gap-1.5 opacity-25">
        {[30, 52, 22, 64, 40].map((barHeight, index) => (
          <div
            key={index}
            className="w-3 rounded-t bg-gradient-to-t from-primary/40 to-cyan/40"
            style={{ height: barHeight }}
          />
        ))}
      </div>
      <p className="text-xs text-subtle">{message}</p>
    </div>
  );
}

/** Gradient <defs> shared by the area and bar charts. */
export function ChartGradients() {
  return (
    <defs>
      <linearGradient id="fx-income" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#22C55E" stopOpacity={0.45} />
        <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="fx-expense" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#EF4444" stopOpacity={0.4} />
        <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="fx-primary" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.5} />
        <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="fx-cyan" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.45} />
        <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="fx-bar-primary" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#A855F7" />
        <stop offset="100%" stopColor="#7C3AED" />
      </linearGradient>
      <linearGradient id="fx-bar-cyan" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#0EA5E9" />
      </linearGradient>
      <linearGradient id="fx-bar-success" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#4ADE80" />
        <stop offset="100%" stopColor="#16A34A" />
      </linearGradient>
      <linearGradient id="fx-bar-danger" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F87171" />
        <stop offset="100%" stopColor="#DC2626" />
      </linearGradient>
    </defs>
  );
}

/** Shared axis styling so every chart lines up visually. */
export const axisProps = {
  stroke: "transparent",
  tickLine: false,
  axisLine: false,
  tick: { fill: "#71717A", fontSize: 11 },
} as const;
