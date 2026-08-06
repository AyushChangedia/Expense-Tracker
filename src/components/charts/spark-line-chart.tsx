"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompactNumber } from "@/lib/currency";
import { usePreferences } from "@/components/providers/preferences-provider";
import {
  ChartEmpty,
  ChartTooltip,
  axisProps,
} from "@/components/charts/chart-primitives";

type LineSeries = {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
};

type LineChartProps<T extends Record<string, unknown>> = {
  data: T[];
  xKey: keyof T & string;
  series: LineSeries[];
  height?: number;
  emptyMessage?: string;
  /** Allow the Y axis to start above zero — useful for net-worth curves. */
  autoDomain?: boolean;
};

/** Multi-line chart used for net worth, savings growth, and income trend. */
export function TrendLineChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  height = 260,
  emptyMessage,
  autoDomain = false,
}: LineChartProps<T>) {
  const { locale, formatMoney } = usePreferences();

  const hasData = React.useMemo(
    () =>
      data.length > 0 &&
      data.some((point) =>
        series.some((item) => Number(point[item.key as keyof T] ?? 0) !== 0),
      ),
    [data, series],
  );

  if (!hasData) {
    return <ChartEmpty message={emptyMessage} height={height} />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} dy={6} minTickGap={8} />
        <YAxis
          {...axisProps}
          width={56}
          domain={autoDomain ? ["auto", "auto"] : undefined}
          tickFormatter={(value: number) => formatCompactNumber(value, locale)}
        />
        <Tooltip
          content={<ChartTooltip formatValue={(value) => formatMoney(value)} />}
          cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1 }}
        />

        {series.map((item, index) => (
          <Line
            key={item.key}
            type="monotone"
            dataKey={item.key}
            name={item.label}
            stroke={item.color}
            strokeWidth={2.25}
            strokeDasharray={item.dashed ? "5 4" : undefined}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#08080B", fill: item.color }}
            animationDuration={1000}
            animationBegin={index * 120}
            animationEasing="ease-out"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Tiny inline chart for stat cards — no axes, no tooltip, just the shape of
 * the recent trend.
 */
export function Sparkline({
  data,
  color = "#8B5CF6",
  height = 40,
}: {
  data: { value: number }[];
  color?: string;
  height?: number;
}) {
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
