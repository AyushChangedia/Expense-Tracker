import { prisma } from "@/lib/prisma";
import { lastNMonths, monthKey, monthKeyOf, monthRange } from "@/lib/dates";
import { round2 } from "@/lib/utils";
import { standing } from "@/lib/budget-math";
import { serialize } from "@/lib/serialize";
import { monthProgress } from "@/server/queries/analytics";
import type { BudgetProgress } from "@/types";

/**
 * Budgets for a month, each joined to what was actually spent against it.
 *
 * A budget with `categoryId: null` is an overall cap covering every expense
 * category, so its spend is the month's entire expense total.
 */
export async function getBudgetProgress(
  userId: string,
  year: number,
  month: number,
  now = new Date(),
): Promise<BudgetProgress[]> {
  const { start, end } = monthRange(year, month);

  const [budgets, grouped, overall] = await Promise.all([
    prisma.budget.findMany({
      where: { userId, year, month },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            kind: true,
            icon: true,
            gradientFrom: true,
            gradientTo: true,
            isDefault: true,
            isFavorite: true,
            sortOrder: true,
          },
        },
      },
      orderBy: [{ categoryId: "asc" }],
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "EXPENSE", date: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: "EXPENSE", date: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const spendByCategory = new Map(
    grouped.map((row) => [
      row.categoryId,
      {
        spent: row._sum.amount ? Number(row._sum.amount) : 0,
        count: row._count._all,
      },
    ]),
  );

  const { dayOfMonth, daysInMonth } = monthProgress(year, month, now);

  return budgets.map((budget) => {
    const amount = Number(budget.amount);
    const usage = budget.categoryId
      ? (spendByCategory.get(budget.categoryId) ?? { spent: 0, count: 0 })
      : {
          spent: overall._sum.amount ? Number(overall._sum.amount) : 0,
          count: overall._count._all,
        };

    return {
      id: budget.id,
      categoryId: budget.categoryId,
      amount: round2(amount),
      month: budget.month,
      year: budget.year,
      category: budget.category ? serialize(budget.category) : null,
      transactionCount: usage.count,
      ...standing(amount, usage.spent, dayOfMonth, daysInMonth),
    };
  });
}

/** Budget vs actual for the last N months — the analytics comparison chart. */
export async function getBudgetHistory(
  userId: string,
  months = 6,
  reference = new Date(),
) {
  const points: {
    key: string;
    label: string;
    budgeted: number;
    spent: number;
  }[] = [];

  // lastNMonths is the one place that decides what "the last six months" means,
  // and it already returns the UTC range for each. This used to build the same
  // list by hand with its own cursor, which is a second answer to the same
  // question waiting to drift from the first.
  const windows = lastNMonths(months, reference);

  const earliest = windows[0].start;
  const latest = windows[windows.length - 1].end;

  const [budgets, expenses] = await Promise.all([
    prisma.budget.findMany({
      where: {
        userId,
        OR: windows.map((window) => ({ year: window.year, month: window.month })),
      },
      select: { amount: true, month: true, year: true, categoryId: true },
    }),
    prisma.transaction.findMany({
      where: { userId, type: "EXPENSE", date: { gte: earliest, lt: latest } },
      select: { amount: true, date: true },
    }),
  ]);

  for (const window of windows) {
    const monthBudgets = budgets.filter(
      (budget) => budget.year === window.year && budget.month === window.month,
    );

    // An overall budget supersedes the per-category sum — otherwise the same
    // money would be counted twice.
    const overall = monthBudgets.find((budget) => budget.categoryId === null);
    const budgeted = overall
      ? Number(overall.amount)
      : monthBudgets.reduce((acc, budget) => acc + Number(budget.amount), 0);

    const key = monthKey(window.year, window.month);
    const spent = expenses
      .filter((row) => monthKeyOf(row.date) === key)
      .reduce((acc, row) => acc + Number(row.amount), 0);

    points.push({
      key,
      label: window.label,
      budgeted: round2(budgeted),
      spent: round2(spent),
    });
  }

  return points;
}
