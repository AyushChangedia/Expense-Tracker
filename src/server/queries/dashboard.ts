import { currentMonthKey, monthRange } from "@/lib/dates";
import { buildInsights } from "@/lib/insights";
import { runDueRecurring } from "@/lib/recurring";
import type { SessionUser } from "@/lib/session";
import {
  getCategoryBreakdown,
  getMonthlyTrend,
  getNetWorthSeries,
  getSavingsGrowth,
  getSummary,
  getWeekdayAverages,
  getWeeklySpending,
  monthProgress,
} from "@/server/queries/analytics";
import { getActivities } from "@/server/queries/activity";
import { getBudgetHistory, getBudgetProgress } from "@/server/queries/budgets";
import { getGoals } from "@/server/queries/goals";
import { getUpcomingRecurring } from "@/server/queries/recurring";
import {
  getPinnedTransactions,
  getRecentTransactions,
} from "@/server/queries/transactions";
import type { DashboardData } from "@/types";

/**
 * Everything the dashboard renders, gathered in one pass.
 *
 * The queries are independent, so they run concurrently — the page costs one
 * round of parallel reads rather than a dozen sequential ones.
 */
export async function getDashboardData(
  user: SessionUser,
  options: { year?: number; month?: number } = {},
): Promise<DashboardData> {
  // Post any recurring entries that came due before reading the numbers, so
  // the dashboard never shows a stale total.
  await runDueRecurring(user.id);

  const fallback = currentMonthKey();
  const year = options.year ?? fallback.year;
  const month = options.month ?? fallback.month;
  const { start, end } = monthRange(year, month);

  const [
    summary,
    categoryBreakdown,
    monthlyTrend,
    weeklySpending,
    recentTransactions,
    budgets,
    goals,
    activities,
    pinned,
    upcomingRecurring,
  ] = await Promise.all([
    getSummary(user.id, year, month),
    getCategoryBreakdown(user.id, start, end, "EXPENSE"),
    getMonthlyTrend(user.id, 12),
    getWeeklySpending(user.id, user.weekStart === 1 ? 1 : 0),
    getRecentTransactions(user.id, 8),
    getBudgetProgress(user.id, year, month),
    getGoals(user.id),
    getActivities(user.id, 8),
    getPinnedTransactions(user.id, 4),
    getUpcomingRecurring(user.id, 4),
  ]);

  const insights = buildInsights({
    summary,
    categoryBreakdown,
    monthlyTrend,
    weeklySpending,
    budgets,
    goals,
    recentTransactions,
    currency: user.currency,
    locale: user.locale,
    monthProgress: monthProgress(year, month),
  });

  return {
    summary,
    categoryBreakdown,
    monthlyTrend,
    weeklySpending,
    recentTransactions,
    budgets,
    goals,
    insights,
    activities,
    pinned,
    upcomingRecurring,
  };
}

export type AnalyticsData = Awaited<ReturnType<typeof getAnalyticsData>>;

export async function getAnalyticsData(
  user: SessionUser,
  options: { year?: number; month?: number; range?: number } = {},
) {
  const fallback = currentMonthKey();
  const year = options.year ?? fallback.year;
  const month = options.month ?? fallback.month;
  const range = options.range ?? 12;
  const { start, end } = monthRange(year, month);

  const [
    summary,
    monthlyTrend,
    expenseBreakdown,
    incomeBreakdown,
    netWorth,
    savingsGrowth,
    budgetHistory,
    weekdayAverages,
    weeklySpending,
    goals,
  ] = await Promise.all([
    getSummary(user.id, year, month),
    getMonthlyTrend(user.id, range),
    getCategoryBreakdown(user.id, start, end, "EXPENSE"),
    getCategoryBreakdown(user.id, start, end, "INCOME"),
    getNetWorthSeries(user.id, range),
    getSavingsGrowth(user.id, range),
    getBudgetHistory(user.id, Math.min(range, 6)),
    getWeekdayAverages(user.id, 3),
    getWeeklySpending(user.id, user.weekStart === 1 ? 1 : 0),
    getGoals(user.id),
  ]);

  return {
    year,
    month,
    range,
    summary,
    monthlyTrend,
    expenseBreakdown,
    incomeBreakdown,
    netWorth,
    savingsGrowth,
    budgetHistory,
    weekdayAverages,
    weeklySpending,
    goals,
  };
}
