"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

type BarSeries = {
  key: string;
  label: string;
  color: string;
  /** Reference a gradient from ChartGradients instead of a flat colour. */
  fill?: string;
};

type ComparisonBarChartProps<T extends Record<string, unknown>> = {
  data: T[];
  xKey: keyof T & string;
  series: BarSeries[];
  height?: number;
  emptyMessage?: string;
  showLegend?: boolean;
  /** Colour each bar of the first series individually. */
  colorByPoint?: (point: T, index: number) => string;
  radius?: number;
  layout?: "horizontal" | "vertical";
};

export function ComparisonBarChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  height = 280,
  emptyMessage,
  showLegend = true,
  colorByPoint,
  radius = 6,
  layout = "horizontal",
}: ComparisonBarChartProps<T>) {
  const { locale, formatMoney } = usePreferences();

  const hasData = React.useMemo(
    () =>
      data.some((point) =>
        series.some((item) => Number(point[item.key as keyof T] ?? 0) !== 0),
      ),
    [data, series],
  );

  if (!hasData) {
    return <ChartEmpty message={emptyMessage} height={height} />;
  }

  const isVertical = layout === "vertical";

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={layout}
          margin={
            isVertical
              ? { top: 4, right: 16, left: 8, bottom: 4 }
              : { top: 8, right: 8, left: -18, bottom: 0 }
          }
          barGap={4}
        >
          <ChartGradients />
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={isVertical}
            horizontal={!isVertical}
          />

          {isVertical ? (
            <>
              <XAxis
                type="number"
                {...axisProps}
                tickFormatter={(value: number) => formatCompactNumber(value, locale)}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                {...axisProps}
                width={90}
                interval={0}
              />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...axisProps} dy={6} minTickGap={4} />
              <YAxis
                {...axisProps}
                width={56}
                tickFormatter={(value: number) => formatCompactNumber(value, locale)}
              />
            </>
          )}

          <Tooltip
            content={<ChartTooltip formatValue={(value) => formatMoney(value)} />}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />

          {series.map((item, seriesIndex) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              fill={item.fill ?? item.color}
              radius={
                isVertical ? [0, radius, radius, 0] : [radius, radius, 0, 0]
              }
              maxBarSize={isVertical ? 22 : 44}
              animationDuration={900}
              animationBegin={seriesIndex * 100}
              animationEasing="ease-out"
            >
              {colorByPoint && seriesIndex === 0
                ? data.map((point, index) => (
                    <Cell key={index} fill={colorByPoint(point, index)} />
                  ))
                : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>

      {showLegend && series.length > 1 ? (
        <ChartLegend
          items={series.map((item) => ({ label: item.label, color: item.color }))}
          className="justify-center"
        />
      ) : null}
    </div>
  );
}
