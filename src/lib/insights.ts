import { formatCurrency } from "@/lib/currency";
import { percentChange, round2 } from "@/lib/utils";
import type {
  BudgetProgress,
  CategoryBreakdownItem,
  DailyPoint,
  GoalDTO,
  Insight,
  MonthlyTrendPoint,
  StatSummary,
  TransactionDTO,
} from "@/types";

/**
 * The insights engine.
 *
 * Every insight is derived arithmetically from the user's own aggregates —
 * there is no model call and no API key, so the panel produces the same
 * explainable output on any deployment. Rules are scored and the strongest
 * signals surface first.
 */

type InsightContext = {
  summary: StatSummary;
  categoryBreakdown: CategoryBreakdownItem[];
  monthlyTrend: MonthlyTrendPoint[];
  weeklySpending: DailyPoint[];
  budgets: BudgetProgress[];
  goals: GoalDTO[];
  recentTransactions: TransactionDTO[];
  currency: string;
  locale: string;
  /** Elapsed / total days in the current month, used for pace projections. */
  monthProgress: { dayOfMonth: number; daysInMonth: number };
};

type ScoredInsight = Insight & { score: number };

export function buildInsights(context: InsightContext): Insight[] {
  const {
    summary,
    categoryBreakdown,
    monthlyTrend,
    weeklySpending,
    budgets,
    goals,
    recentTransactions,
    currency,
    locale,
    monthProgress,
  } = context;

  const money = (value: number) => formatCurrency(value, { currency, locale });
  const insights: ScoredInsight[] = [];

  // --- Budget pressure ----------------------------------------------------

  const exceeded = budgets.filter((budget) => budget.status === "exceeded");
  if (exceeded.length > 0) {
    const worst = [...exceeded].sort((a, b) => b.percentUsed - a.percentUsed)[0];
    const over = worst.spent - worst.amount;
    insights.push({
      id: "budget-exceeded",
      title: `${worst.category?.name ?? "Overall"} budget exceeded`,
      detail:
        exceeded.length === 1
          ? `You are ${money(over)} over your ${money(worst.amount)} budget. Pausing this category for the rest of the month brings you back on plan.`
          : `${exceeded.length} budgets are over plan, led by ${worst.category?.name ?? "your overall budget"} at ${money(over)} above its limit.`,
      tone: "critical",
      icon: "AlertTriangle",
      metric: `${Math.round(worst.percentUsed)}% used`,
      score: 100,
    });
  }

  const nearing = budgets.filter((budget) => budget.status === "warning");
  if (nearing.length > 0 && exceeded.length === 0) {
    const closest = [...nearing].sort((a, b) => b.percentUsed - a.percentUsed)[0];
    insights.push({
      id: "budget-warning",
      title: `${closest.category?.name ?? "Overall"} budget is running hot`,
      detail: `${Math.round(closest.percentUsed)}% spent with ${money(closest.remaining)} left. Keeping under ${money(closest.dailyAllowance)} a day finishes the month on target.`,
      tone: "warning",
      icon: "Gauge",
      metric: `${money(closest.remaining)} left`,
      score: 88,
    });
  }

  // A budget that is fine today but will not be by month end.
  const projectedOverrun = budgets
    .filter(
      (budget) =>
        budget.status !== "exceeded" &&
        budget.projectedSpend > budget.amount * 1.05 &&
        monthProgress.dayOfMonth >= 5,
    )
    .sort((a, b) => b.projectedSpend - b.amount - (a.projectedSpend - a.amount))[0];

  if (projectedOverrun) {
    insights.push({
      id: "budget-projection",
      title: `On pace to overspend on ${projectedOverrun.category?.name ?? "your overall budget"}`,
      detail: `At the current rate you will finish the month around ${money(projectedOverrun.projectedSpend)} against a ${money(projectedOverrun.amount)} budget.`,
      tone: "warning",
      icon: "TrendingUp",
      metric: `Projected ${money(projectedOverrun.projectedSpend)}`,
      score: 74,
    });
  }

  // --- Cash flow ----------------------------------------------------------

  if (summary.netCashFlow < 0 && summary.expenses > 0) {
    insights.push({
      id: "negative-cash-flow",
      title: "Spending outpaced income this month",
      detail: `Expenses of ${money(summary.expenses)} exceeded ${money(summary.income)} of income, leaving a ${money(Math.abs(summary.netCashFlow))} shortfall.`,
      tone: "critical",
      icon: "TrendingDown",
      metric: money(summary.netCashFlow),
      score: 95,
    });
  } else if (summary.savingsRate >= 20) {
    insights.push({
      id: "strong-savings",
      title: `You kept ${Math.round(summary.savingsRate)}% of your income`,
      detail: `${money(summary.savings)} stayed in your pocket this month — comfortably above the 20% rule of thumb.`,
      tone: "positive",
      icon: "PiggyBank",
      metric: `${Math.round(summary.savingsRate)}% saved`,
      score: 70,
    });
  } else if (summary.savingsRate > 0 && summary.savingsRate < 10 && summary.income > 0) {
    insights.push({
      id: "thin-savings",
      title: "Savings rate is thin",
      detail: `Only ${Math.round(summary.savingsRate)}% of income was left over. Trimming ${money(Math.max(0, summary.income * 0.1 - summary.savings))} of spending would lift you to 10%.`,
      tone: "warning",
      icon: "PiggyBank",
      metric: `${Math.round(summary.savingsRate)}% saved`,
      score: 68,
    });
  }

  // --- Month-over-month movement -----------------------------------------

  if (summary.expenseChange !== null && Math.abs(summary.expenseChange) >= 15) {
    const rising = summary.expenseChange > 0;
    insights.push({
      id: "expense-shift",
      title: rising
        ? `Spending is up ${Math.round(summary.expenseChange)}% on last month`
        : `Spending is down ${Math.round(Math.abs(summary.expenseChange))}% on last month`,
      detail: rising
        ? `You have spent ${money(summary.expenses)} so far against a lower total last month. The categories below show where the increase landed.`
        : `You have spent ${money(summary.expenses)}, noticeably less than last month. Worth locking in as the new normal.`,
      tone: rising ? "warning" : "positive",
      icon: rising ? "ArrowUpRight" : "ArrowDownRight",
      metric: `${summary.expenseChange > 0 ? "+" : ""}${Math.round(summary.expenseChange)}%`,
      score: rising ? 72 : 60,
    });
  }

  // --- Category concentration --------------------------------------------

  const topCategory = categoryBreakdown[0];
  if (topCategory && topCategory.share >= 35 && summary.expenses > 0) {
    insights.push({
      id: "category-concentration",
      title: `${topCategory.name} dominates your spending`,
      detail: `${money(topCategory.total)} across ${topCategory.count} ${topCategory.count === 1 ? "transaction" : "transactions"} — ${Math.round(topCategory.share)}% of everything you spent this month.`,
      tone: "neutral",
      icon: "PieChart",
      metric: `${Math.round(topCategory.share)}% of spend`,
      score: 66,
    });
  }

  // A category that grew sharply against its own recent average.
  if (monthlyTrend.length >= 3 && topCategory) {
    const averageExpenses =
      monthlyTrend.slice(0, -1).reduce((acc, point) => acc + point.expenses, 0) /
      Math.max(1, monthlyTrend.length - 1);
    const change = percentChange(summary.expenses, averageExpenses);
    if (change !== null && change >= 25 && averageExpenses > 0) {
      insights.push({
        id: "above-average-month",
        title: "This month is heavier than your usual",
        detail: `You are running ${Math.round(change)}% above your ${monthlyTrend.length - 1}-month average of ${money(averageExpenses)}.`,
        tone: "warning",
        icon: "Activity",
        metric: `Avg ${money(averageExpenses)}`,
        score: 64,
      });
    }
  }

  // --- Weekly rhythm ------------------------------------------------------

  const spendingDays = weeklySpending.filter((day) => day.expenses > 0);
  if (spendingDays.length >= 3) {
    const heaviest = [...spendingDays].sort((a, b) => b.expenses - a.expenses)[0];
    const weekTotal = spendingDays.reduce((acc, day) => acc + day.expenses, 0);
    if (heaviest.expenses / weekTotal >= 0.4) {
      insights.push({
        id: "heavy-day",
        title: `${heaviest.label} is your heaviest day`,
        detail: `${money(heaviest.expenses)} of this week's ${money(weekTotal)} landed on a single day.`,
        tone: "neutral",
        icon: "CalendarDays",
        metric: money(heaviest.expenses),
        score: 48,
      });
    }
  }

  // --- Recurring / subscription load --------------------------------------

  const subscriptionSpend = categoryBreakdown.find(
    (item) => item.name.toLowerCase() === "subscriptions",
  );
  if (subscriptionSpend && summary.income > 0) {
    const shareOfIncome = (subscriptionSpend.total / summary.income) * 100;
    if (shareOfIncome >= 8) {
      insights.push({
        id: "subscription-load",
        title: "Subscriptions are taking a real bite",
        detail: `${money(subscriptionSpend.total)} across ${subscriptionSpend.count} charges is ${Math.round(shareOfIncome)}% of your income. Cancelling the least-used one is usually the quickest win.`,
        tone: "warning",
        icon: "RefreshCw",
        metric: `${Math.round(shareOfIncome)}% of income`,
        score: 62,
      });
    }
  }

  // --- Large one-off ------------------------------------------------------

  const expenses = recentTransactions.filter((item) => item.type === "EXPENSE");
  if (expenses.length >= 4) {
    const amounts = expenses.map((item) => item.amount);
    const mean = amounts.reduce((acc, value) => acc + value, 0) / amounts.length;
    const largest = expenses.reduce((max, item) => (item.amount > max.amount ? item : max));
    if (mean > 0 && largest.amount >= mean * 3) {
      insights.push({
        id: "outlier-expense",
        title: `${largest.description} stands out`,
        detail: `At ${money(largest.amount)} it is roughly ${Math.round(largest.amount / mean)}× your typical transaction size.`,
        tone: "neutral",
        icon: "Sparkles",
        metric: money(largest.amount),
        score: 44,
      });
    }
  }

  // --- Goals --------------------------------------------------------------

  const activeGoals = goals.filter((goal) => goal.status === "ACTIVE");
  // A goal is at risk when this month's saving does not cover what it needs.
  // The `savings > 0` guard this replaces suppressed the warning exactly when
  // it mattered most: a month that saved nothing, or ran a deficit, cleared
  // the filter for every goal and the panel said nothing at all.
  const atRisk = activeGoals.filter(
    (goal) => goal.requiredPerMonth !== null && goal.requiredPerMonth > summary.savings,
  );
  if (atRisk.length > 0) {
    // The widest shortfall first, rather than whichever goal happened to be
    // returned first by the query.
    const goal = [...atRisk].sort(
      (a, b) => (b.requiredPerMonth ?? 0) - (a.requiredPerMonth ?? 0),
    )[0];
    const needed = goal.requiredPerMonth ?? 0;
    const savedThisMonth =
      summary.savings > 0
        ? `you saved ${money(summary.savings)} this month`
        : summary.savings === 0
          ? "nothing was left over this month"
          : `this month you were ${money(Math.abs(summary.savings))} short of breaking even`;

    insights.push({
      id: "goal-at-risk",
      title: `"${goal.name}" needs a bigger monthly push`,
      detail: `Hitting the target on time takes ${money(needed)} a month, and ${savedThisMonth}.`,
      tone: "warning",
      icon: "Target",
      metric: `${Math.round(goal.percentComplete)}% funded`,
      score: 58,
    });
  }

  const nearlyDone = activeGoals.find(
    (goal) => goal.percentComplete >= 80 && goal.percentComplete < 100,
  );
  if (nearlyDone) {
    insights.push({
      id: "goal-close",
      title: `"${nearlyDone.name}" is nearly there`,
      detail: `${money(nearlyDone.remaining)} to go and the goal is complete.`,
      tone: "positive",
      icon: "Trophy",
      metric: `${Math.round(nearlyDone.percentComplete)}% funded`,
      score: 56,
    });
  }

  // --- Daily pace ---------------------------------------------------------

  if (summary.expenses > 0 && monthProgress.dayOfMonth >= 3) {
    const perDay = summary.expenses / monthProgress.dayOfMonth;
    const projected = perDay * monthProgress.daysInMonth;
    insights.push({
      id: "daily-pace",
      title: `Averaging ${money(round2(perDay))} a day`,
      detail: `Holding this pace puts the month at about ${money(round2(projected))} in total spending.`,
      tone: "neutral",
      icon: "Clock",
      metric: money(round2(projected)),
      score: 40,
    });
  }

  // --- Empty state --------------------------------------------------------

  if (insights.length === 0) {
    insights.push({
      id: "getting-started",
      title: "Add a few transactions to unlock insights",
      detail:
        "Once there is a couple of weeks of activity, this panel starts calling out budget pressure, spending shifts, and goal progress automatically.",
      tone: "neutral",
      icon: "Sparkles",
      score: 1,
    });
  }

  return insights
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ score: _score, ...insight }) => insight);
}
