"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";
import { motion } from "framer-motion";

import { getCategoryIcon } from "@/lib/categories";
import { usePreferences } from "@/components/providers/preferences-provider";
import { ChartEmpty, ChartTooltip } from "@/components/charts/chart-primitives";
import { cn } from "@/lib/utils";
import type { CategoryBreakdownItem } from "@/types";

type CategoryPieChartProps = {
  data: CategoryBreakdownItem[];
  height?: number;
  emptyMessage?: string;
  /** Show the scrollable legend beside the donut. */
  showLegend?: boolean;
  maxLegendItems?: number;
};

/**
 * Donut chart of spending by category.
 *
 * The active slice expands on hover and the centre swaps to that category's
 * total, which is far more readable than crowding labels around the ring.
 */
export function CategoryPieChart({
  data,
  height = 280,
  emptyMessage = "No spending in this period",
  showLegend = true,
  maxLegendItems = 8,
}: CategoryPieChartProps) {
  const { formatMoney } = usePreferences();
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const total = React.useMemo(
    () => data.reduce((acc, item) => acc + item.total, 0),
    [data],
  );

  if (data.length === 0 || total === 0) {
    return <ChartEmpty message={emptyMessage} height={height} />;
  }

  const active = activeIndex !== null ? data[activeIndex] : null;
  const legendItems = data.slice(0, maxLegendItems);
  const overflow = data.length - legendItems.length;

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2.5}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              activeIndex={activeIndex ?? undefined}
              activeShape={(props: React.ComponentProps<typeof Sector>) => (
                <Sector
                  {...props}
                  outerRadius={Number(props.outerRadius ?? 0) + 7}
                  style={{ filter: "brightness(1.15)" }}
                />
              )}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              animationDuration={900}
              animationEasing="ease-out"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.categoryId}
                  fill={entry.gradientFrom}
                  className="cursor-pointer outline-none transition-all"
                />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip hideLabel formatValue={(value) => formatMoney(value)} />
              }
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Centre readout — reflects the hovered slice, or the total. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.div
            key={active?.categoryId ?? "total"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="px-6"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-subtle">
              {active ? active.name : "Total spent"}
            </p>
            <p className="tabular mt-1 text-xl font-semibold text-white">
              {formatMoney(active ? active.total : total, { compact: true })}
            </p>
            {active ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {Math.round(active.share)}% · {active.count}{" "}
                {active.count === 1 ? "entry" : "entries"}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.length} {data.length === 1 ? "category" : "categories"}
              </p>
            )}
          </motion.div>
        </div>
      </div>

      {showLegend ? (
        <div className="w-full min-w-0 flex-1 space-y-1">
          {legendItems.map((item, index) => {
            const Icon = getCategoryIcon(item.icon);
            const isActive = activeIndex === index;

            return (
              <button
                key={item.categoryId}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-200",
                  isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.04]",
                )}
              >
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, ${item.gradientFrom}2E, ${item.gradientTo}1A)`,
                  }}
                >
                  <Icon
                    className="size-3.5"
                    style={{ color: item.gradientFrom }}
                    strokeWidth={2}
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">{item.name}</span>
                  <span className="block text-[11px] text-subtle">
                    {item.count} {item.count === 1 ? "entry" : "entries"}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="tabular block text-sm font-semibold text-white">
                    {formatMoney(item.total, { compact: true })}
                  </span>
                  <span className="tabular block text-[11px] text-subtle">
                    {Math.round(item.share)}%
                  </span>
                </span>
              </button>
            );
          })}

          {overflow > 0 ? (
            <p className="px-2.5 pt-1 text-[11px] text-subtle">
              + {overflow} more {overflow === 1 ? "category" : "categories"}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
