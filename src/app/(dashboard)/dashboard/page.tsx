import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCards } from "@/components/dashboard/stat-cards";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { BudgetOverview } from "@/components/dashboard/budget-overview";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import {
  GoalsPreview,
  PinnedTransactions,
  UpcomingRecurring,
} from "@/components/dashboard/side-panels";
import { QuickAdd } from "@/components/transactions/quick-add";
import { QuickAddButtons } from "@/components/dashboard/quick-add-buttons";
import { PageTransition } from "@/components/shared/reveal";
import { requireUser } from "@/lib/session";
import { getDashboardData } from "@/server/queries/dashboard";
import { monthLabel, currentMonthKey } from "@/lib/dates";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your month at a glance.",
};

// Data changes on every write, so this page always renders fresh.
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const user = await requireUser();
  const data = await getDashboardData(user);
  const { year, month } = currentMonthKey();

  const firstName = user.name?.split(" ")[0];

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow={monthLabel(year, month)}
        title={firstName ? `Welcome back, ${firstName}` : "Your dashboard"}
        description={
          data.summary.transactionCount > 0
            ? `${data.summary.transactionCount} ${
                data.summary.transactionCount === 1 ? "transaction" : "transactions"
              } recorded this month.`
            : "Nothing recorded this month yet — add your first transaction below."
        }
        actions={<QuickAddButtons />}
      />

      {/* Natural-language quick add sits above the fold on purpose. */}
      <div className="glass glow-border p-4 sm:p-5">
        <QuickAdd />
      </div>

      <StatCards summary={data.summary} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DashboardCharts
            monthlyTrend={data.monthlyTrend}
            categoryBreakdown={data.categoryBreakdown}
            weeklySpending={data.weeklySpending}
          />
        </div>

        <div className="space-y-4">
          <BudgetOverview budgets={data.budgets} />
          <GoalsPreview goals={data.goals} />
        </div>
      </div>

      {data.insights.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-white">
              What your numbers are saying
            </h2>
            <p className="text-xs text-muted-foreground">
              Derived from your own transactions — no guesswork, no averages
              borrowed from strangers.
            </p>
          </div>
          <InsightsPanel insights={data.insights.slice(0, 4)} columns={2} />
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentTransactions transactions={data.recentTransactions} />
        </div>

        <div className="space-y-4">
          <PinnedTransactions transactions={data.pinned} />
          <UpcomingRecurring rules={data.upcomingRecurring} />
          <ActivityTimeline activities={data.activities} />
        </div>
      </div>
    </PageTransition>
  );
}
