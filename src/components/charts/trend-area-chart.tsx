"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompactNumber } from "@/lib/currency";
import { usePreferences } from "@/components/providers/preferences-provider";
import {
  ChartEmpty,
  ChartGradients,
  ChartLegend,
  ChartTooltip,
  axisProps,
} from "@/components/charts/chart-primitives";

type Series = {
  key: string;
  label: string;
  color: string;
  gradientId: string;
};

type TrendAreaChartProps<T extends Record<string, unknown>> = {
  data: T[];
  xKey: keyof T & string;
  series: Series[];
  height?: number;
  emptyMessage?: string;
  showLegend?: boolean;
  labelKey?: keyof T & string;
};

/**
 * Stacked-free multi-series area chart used for income vs expense and the
 * monthly trend. Animations run once on mount, matching the rest of the app's
 * "settle into place" feel.
 */
export function TrendAreaChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  height = 280,
  emptyMessage,
  showLegend = true,
  labelKey,
}: TrendAreaChartProps<T>) {
  const { locale, formatMoney } = usePreferences();

  const hasData = React.useMemo(
    () =>
      data.some((point) =>
        series.some((item) => Number(point[item.key as keyof T] ?? 0) !== 0),
      ),
    [data, series],
  );

  const labelLookup = React.useMemo(() => {
    if (!labelKey) return null;
    return new Map(
      data.map((point) => [String(point[xKey]), String(point[labelKey] ?? point[xKey])]),
    );
  }, [data, labelKey, xKey]);

  if (!hasData) {
    return <ChartEmpty message={emptyMessage} height={height} />;
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <ChartGradients />
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} dy={6} minTickGap={8} />
          <YAxis
            {...axisProps}
            width={56}
            tickFormatter={(value: number) => formatCompactNumber(value, locale)}
          />
          <Tooltip
            content={
              <ChartTooltip
                formatValue={(value) => formatMoney(value)}
                labelFormatter={(label) => labelLookup?.get(label) ?? label}
              />
            }
            cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1 }}
          />

          {series.map((item, index) => (
            <Area
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={item.color}
              strokeWidth={2}
              fill={`url(#${item.gradientId})`}
              fillOpacity={1}
              // Staggering the series makes the reveal feel deliberate.
              animationDuration={900}
              animationBegin={index * 120}
              animationEasing="ease-out"
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: "#08080B",
                fill: item.color,
              }}
              dot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {showLegend ? (
        <ChartLegend
          items={series.map((item) => ({ label: item.label, color: item.color }))}
          className="justify-center"
        />
      ) : null}
    </div>
  );
}
