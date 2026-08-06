"use client";

import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionHeading } from "@/components/shared/page-header";
import { TrendAreaChart } from "@/components/charts/trend-area-chart";
import { ComparisonBarChart } from "@/components/charts/comparison-bar-chart";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { usePreferences } from "@/components/providers/preferences-provider";
import type { CategoryBreakdownItem, DailyPoint, MonthlyTrendPoint } from "@/types";

/**
 * The dashboard's chart deck.
 *
 * Grouped into tabs rather than stacked so the fold stays useful on a laptop —
 * each view answers a different question about the same month.
 */
export function DashboardCharts({
  monthlyTrend,
  categoryBreakdown,
  weeklySpending,
}: {
  monthlyTrend: MonthlyTrendPoint[];
  categoryBreakdown: CategoryBreakdownItem[];
  weeklySpending: DailyPoint[];
}) {
  const { formatMoney } = usePreferences();

  const weekTotal = React.useMemo(
    () => weeklySpending.reduce((acc, day) => acc + day.expenses, 0),
    [weeklySpending],
  );

  return (
    <div className="glass glow-border overflow-hidden">
      <div className="p-5 pb-0 sm:p-6 sm:pb-0">
        <Tabs defaultValue="trend">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <SectionHeading
              title="Money in, money out"
              description="Twelve months of income against expenses"
            />

            <TabsList className="w-full overflow-x-auto sm:w-auto">
              <TabsTrigger value="trend">Trend</TabsTrigger>
              <TabsTrigger value="compare">Compare</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="week">This week</TabsTrigger>
            </TabsList>
          </div>

          <div className="pb-6 pt-2">
            <TabsContent value="trend">
              <TrendAreaChart
                data={monthlyTrend}
                xKey="label"
                labelKey="longLabel"
                height={300}
                emptyMessage="Add transactions to see your trend"
                series={[
                  {
                    key: "income",
                    label: "Income",
                    color: "#22C55E",
                    gradientId: "fx-income",
                  },
                  {
                    key: "expenses",
                    label: "Expenses",
                    color: "#EF4444",
                    gradientId: "fx-expense",
                  },
                ]}
              />
            </TabsContent>

            <TabsContent value="compare">
              <ComparisonBarChart
                data={monthlyTrend}
                xKey="label"
                height={300}
                emptyMessage="Add transactions to compare months"
                series={[
                  {
                    key: "income",
                    label: "Income",
                    color: "#22C55E",
                    fill: "url(#fx-bar-success)",
                  },
                  {
                    key: "expenses",
                    label: "Expenses",
                    color: "#EF4444",
                    fill: "url(#fx-bar-danger)",
                  },
                ]}
              />
            </TabsContent>

            <TabsContent value="categories">
              <CategoryPieChart
                data={categoryBreakdown}
                height={280}
                emptyMessage="No spending recorded this month"
              />
            </TabsContent>

            <TabsContent value="week">
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  {weekTotal > 0
                    ? `${formatMoney(weekTotal)} spent so far this week`
                    : "Nothing spent yet this week"}
                </p>
                <ComparisonBarChart
                  data={weeklySpending}
                  xKey="label"
                  height={260}
                  showLegend={false}
                  emptyMessage="No spending yet this week"
                  series={[
                    {
                      key: "expenses",
                      label: "Spent",
                      color: "#8B5CF6",
                      fill: "url(#fx-bar-primary)",
                    },
                  ]}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
