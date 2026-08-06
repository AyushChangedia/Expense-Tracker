"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionHeading } from "@/components/shared/page-header";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { DeltaBadge } from "@/components/shared/amount";
import { TrendAreaChart } from "@/components/charts/trend-area-chart";
import { ComparisonBarChart } from "@/components/charts/comparison-bar-chart";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { TrendLineChart } from "@/components/charts/spark-line-chart";
import { monthLabel, shiftMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { AnalyticsData } from "@/server/queries/dashboard";

const RANGES = [6, 12, 24];

export function AnalyticsView({ data }: { data: AnalyticsData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(patch: Record<string, string | number>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      params.set(key, String(value));
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function goToMonth(delta: number) {
    const next = shiftMonth(data.year, data.month, delta);
    navigate({ year: next.year, month: next.month });
  }

  const headline = [
    { label: "Income", value: data.summary.income, change: data.summary.incomeChange },
    {
      label: "Expenses",
      value: data.summary.expenses,
      change: data.summary.expenseChange,
      invert: true,
    },
    { label: "Savings", value: data.summary.savings, change: data.summary.savingsChange },
    { label: "Balance", value: data.summary.balance, change: null },
  ];

  return (
    <div className="space-y-5">
      {/* Period controls */}
      <div className="glass glow-border flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => goToMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-[140px] text-center">
            <p className="text-sm font-semibold text-white">
              {monthLabel(data.year, data.month)}
            </p>
            <p className="text-[11px] text-subtle">Breakdown period</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => goToMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-subtle">Trend window</span>
          <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => navigate({ range })}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-300",
                  data.range === range
                    ? "text-white"
                    : "text-muted-foreground hover:text-white",
                )}
              >
                {data.range === range ? (
                  <motion.span
                    layoutId="range-pill"
                    className="absolute inset-0 -z-10 rounded-lg bg-brand-gradient"
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  />
                ) : null}
                {range}m
              </button>
            ))}
          </div>

          <Button asChild variant="secondary" size="sm">
            <a href="/api/export?format=xlsx" download>
              <Download className="size-4" />
              Export
            </a>
          </Button>
        </div>
      </div>

      {/* Headline figures */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {headline.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="glass p-4"
          >
            <p className="text-[11px] uppercase tracking-wider text-subtle">
              {item.label}
            </p>
            <p
              className={cn(
                "tabular mt-1 text-xl font-semibold",
                item.value < 0 ? "text-danger" : "text-white",
              )}
            >
              <AnimatedCounter value={item.value} compact />
            </p>
            <div className="mt-1">
              <DeltaBadge value={item.change} invert={item.invert} />
            </div>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full overflow-x-auto sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="cashflow">Cash flow</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="savings">Savings</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="overview" className="space-y-4">
          <ChartCard
            title="Income vs expenses"
            description={`Last ${data.range} months, side by side`}
          >
            <TrendAreaChart
              data={data.monthlyTrend}
              xKey="label"
              labelKey="longLabel"
              height={320}
              series={[
                { key: "income", label: "Income", color: "#22C55E", gradientId: "fx-income" },
                {
                  key: "expenses",
                  label: "Expenses",
                  color: "#EF4444",
                  gradientId: "fx-expense",
                },
              ]}
            />
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Monthly net"
              description="What was left over each month"
            >
              <ComparisonBarChart
                data={data.monthlyTrend}
                xKey="label"
                height={280}
                showLegend={false}
                series={[{ key: "net", label: "Net", color: "#8B5CF6" }]}
                colorByPoint={(point) =>
                  Number((point as { net: number }).net) >= 0 ? "#22C55E" : "#EF4444"
                }
              />
            </ChartCard>

            <ChartCard
              title="Average spend by weekday"
              description="Where your spending habits cluster, last 3 months"
            >
              <ComparisonBarChart
                data={data.weekdayAverages}
                xKey="label"
                height={280}
                showLegend={false}
                emptyMessage="Not enough history yet"
                series={[
                  {
                    key: "average",
                    label: "Average",
                    color: "#38BDF8",
                    fill: "url(#fx-bar-cyan)",
                  },
                ]}
              />
            </ChartCard>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="categories" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Where the money went"
              description={`Expenses by category, ${monthLabel(data.year, data.month)}`}
            >
              <CategoryPieChart data={data.expenseBreakdown} height={300} />
            </ChartCard>

            <ChartCard
              title="Where the money came from"
              description={`Income by category, ${monthLabel(data.year, data.month)}`}
            >
              <CategoryPieChart
                data={data.incomeBreakdown}
                height={300}
                emptyMessage="No income recorded this month"
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Top categories"
            description="Ranked by total spend this month"
          >
            <ComparisonBarChart
              data={data.expenseBreakdown.slice(0, 10)}
              xKey="name"
              layout="vertical"
              height={Math.max(220, data.expenseBreakdown.slice(0, 10).length * 38)}
              showLegend={false}
              series={[{ key: "total", label: "Spent", color: "#8B5CF6" }]}
              colorByPoint={(point) => (point as { gradientFrom: string }).gradientFrom}
            />
          </ChartCard>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="cashflow" className="space-y-4">
          <ChartCard
            title="Net worth"
            description="Running balance across every transaction"
          >
            <TrendLineChart
              data={data.netWorth}
              xKey="label"
              height={300}
              autoDomain
              series={[{ key: "value", label: "Balance", color: "#38BDF8" }]}
              emptyMessage="Add transactions to plot your balance"
            />
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="This week" description="Daily spending, current week">
              <ComparisonBarChart
                data={data.weeklySpending}
                xKey="label"
                height={260}
                showLegend={false}
                emptyMessage="Nothing spent yet this week"
                series={[
                  {
                    key: "expenses",
                    label: "Spent",
                    color: "#8B5CF6",
                    fill: "url(#fx-bar-primary)",
                  },
                ]}
              />
            </ChartCard>

            <ChartCard
              title="Savings rate"
              description="Percentage of income kept, month by month"
            >
              <TrendLineChart
                data={data.monthlyTrend}
                xKey="label"
                height={260}
                autoDomain
                series={[
                  { key: "savingsRate", label: "Savings rate", color: "#22C55E" },
                ]}
                emptyMessage="Record income to see your savings rate"
              />
            </ChartCard>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="budgets" className="space-y-4">
          <ChartCard
            title="Budget vs actual"
            description="How closely you stuck to plan each month"
          >
            <ComparisonBarChart
              data={data.budgetHistory}
              xKey="label"
              height={300}
              emptyMessage="Set a budget to compare against"
              series={[
                {
                  key: "budgeted",
                  label: "Budgeted",
                  color: "#8B5CF6",
                  fill: "url(#fx-bar-primary)",
                },
                {
                  key: "spent",
                  label: "Spent",
                  color: "#38BDF8",
                  fill: "url(#fx-bar-cyan)",
                },
              ]}
            />
          </ChartCard>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="savings" className="space-y-4">
          <ChartCard
            title="Savings growth"
            description="Cumulative contributions across all your goals"
          >
            <TrendLineChart
              data={data.savingsGrowth}
              xKey="label"
              height={300}
              autoDomain
              series={[{ key: "value", label: "Total saved", color: "#22C55E" }]}
              emptyMessage="Contribute to a goal to start the curve"
            />
          </ChartCard>

          {data.goals.length > 0 ? (
            <ChartCard title="Goal progress" description="How each target is tracking">
              <ComparisonBarChart
                data={data.goals.map((goal) => ({
                  name: goal.name,
                  saved: goal.currentAmount,
                  remaining: Math.max(0, goal.targetAmount - goal.currentAmount),
                }))}
                xKey="name"
                layout="vertical"
                height={Math.max(200, data.goals.length * 44)}
                series={[
                  {
                    key: "saved",
                    label: "Saved",
                    color: "#22C55E",
                    fill: "url(#fx-bar-success)",
                  },
                  { key: "remaining", label: "Remaining", color: "#3F3F46" },
                ]}
              />
            </ChartCard>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass glow-border p-5 sm:p-6">
      <SectionHeading title={title} description={description} className="mb-5" />
      {children}
    </div>
  );
}
