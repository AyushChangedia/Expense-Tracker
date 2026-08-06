import type { Metadata } from "next";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { TrendAreaChart } from "@/components/charts/trend-area-chart";
import { SectionHeading } from "@/components/shared/page-header";
import { PageTransition } from "@/components/shared/reveal";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import { currentMonthKey, monthLabel } from "@/lib/dates";
import { getDashboardData } from "@/server/queries/dashboard";

export const metadata: Metadata = {
  title: "Insights",
  description: "What your numbers are telling you this month.",
};

export const dynamic = "force-dynamic";

export default function InsightsPage() {
  return (
    <PageTransition className="space-y-5">
      <PageHeader
        eyebrow="Derived from your data"
        title="Insights"
        description="Every observation below is arithmetic on your own transactions — budget pressure, spending shifts, and goal progress, explained in plain English."
      />

      <Suspense fallback={<InsightsLoading />}>
        <InsightsContent />
      </Suspense>
    </PageTransition>
  );
}

async function InsightsContent() {
  const user = await requireUser();
  const data = await getDashboardData(user);
  const { year, month } = currentMonthKey();

  return (
    <div className="space-y-6">
      <InsightsPanel insights={data.insights} columns={2} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass glow-border p-5 sm:p-6">
          <SectionHeading
            title="Category mix"
            description={`Where spending landed in ${monthLabel(year, month)}`}
            className="mb-5"
          />
          <CategoryPieChart data={data.categoryBreakdown} height={280} />
        </div>

        <div className="glass glow-border p-5 sm:p-6">
          <SectionHeading
            title="The last twelve months"
            description="Income against expenses over time"
            className="mb-5"
          />
          <TrendAreaChart
            data={data.monthlyTrend}
            xKey="label"
            labelKey="longLabel"
            height={280}
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
        </div>
      </div>

      <div className="glass glow-border flex items-start gap-3 p-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10">
          <Sparkles className="size-4 text-primary-300" />
        </span>
        <div>
          <p className="text-sm font-medium text-white">How these are generated</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
            Insights come from a rule engine that scores your aggregates —
            month-over-month deltas, budget pace, category concentration, weekday
            clustering, and goal funding rates — then surfaces the strongest
            signals. No external model is called, so the same numbers always
            produce the same read.
          </p>
        </div>
      </div>
    </div>
  );
}

function InsightsLoading() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <SkeletonCard key={index} className="h-32" />
      ))}
    </div>
  );
}
