import { format, getDaysInMonth, subDays } from "date-fns";

import { prisma } from "@/lib/prisma";
import { lastNMonths, monthRange, toUtcDay, utcDayOf, weekRange } from "@/lib/dates";
import { percentChange, round2 } from "@/lib/utils";
import type {
  CategoryBreakdownItem,
  CumulativePoint,
  DailyPoint,
  MonthlyTrendPoint,
  StatSummary,
} from "@/types";

type Totals = { income: number; expenses: number };

/** One grouped query gives both sides of the ledger for a window. */
async function totalsForRange(
  userId: string,
  start: Date,
  end: Date,
): Promise<Totals> {
  const grouped = await prisma.transaction.groupBy({
    by: ["type"],
    where: { userId, date: { gte: start, lt: end } },
    _sum: { amount: true },
  });

  const income = grouped.find((row) => row.type === "INCOME");
  const expenses = grouped.find((row) => row.type === "EXPENSE");

  return {
    income: income?._sum.amount ? Number(income._sum.amount) : 0,
    expenses: expenses?._sum.amount ? Number(expenses._sum.amount) : 0,
  };
}

async function allTimeTotals(userId: string, before?: Date): Promise<Totals> {
  const grouped = await prisma.transaction.groupBy({
    by: ["type"],
    where: { userId, ...(before ? { date: { lt: before } } : {}) },
    _sum: { amount: true },
  });

  const income = grouped.find((row) => row.type === "INCOME");
  const expenses = grouped.find((row) => row.type === "EXPENSE");

  return {
    income: income?._sum.amount ? Number(income._sum.amount) : 0,
    expenses: expenses?._sum.amount ? Number(expenses._sum.amount) : 0,
  };
}

/**
 * The five headline numbers.
 *
 * Income / expenses / savings describe the selected calendar month. Balance is
 * the all-time running total. Net cash flow is deliberately a rolling 30-day
 * window so it says something the month figures do not — it reacts within days
 * rather than resetting on the 1st.
 */
export async function getSummary(
  userId: string,
  year: number,
  month: number,
  now = new Date(),
): Promise<StatSummary> {
  const current = monthRange(year, month);
  const previous = monthRange(
    month === 1 ? year - 1 : year,
    month === 1 ? 12 : month - 1,
  );

  const today = toUtcDay(now);
  // `today` is already a UTC day, so these re-read it as one rather than
  // reinterpreting it as a local date and losing a day west of Greenwich.
  const rolling30Start = utcDayOf(subDays(today, 29));
  const rolling30End = new Date(today);
  rolling30End.setUTCDate(rolling30End.getUTCDate() + 1);
  const previous30Start = utcDayOf(subDays(today, 59));

  const [currentTotals, previousTotals, lifetime, rolling, priorRolling, count] =
    await Promise.all([
      totalsForRange(userId, current.start, current.end),
      totalsForRange(userId, previous.start, previous.end),
      allTimeTotals(userId),
      totalsForRange(userId, rolling30Start, rolling30End),
      totalsForRange(userId, previous30Start, rolling30Start),
      prisma.transaction.count({
        where: { userId, date: { gte: current.start, lt: current.end } },
      }),
    ]);

  const savings = currentTotals.income - currentTotals.expenses;
  const previousSavings = previousTotals.income - previousTotals.expenses;
  const netCashFlow = rolling.income - rolling.expenses;
  const previousNetCashFlow = priorRolling.income - priorRolling.expenses;

  return {
    income: round2(currentTotals.income),
    expenses: round2(currentTotals.expenses),
    savings: round2(savings),
    balance: round2(lifetime.income - lifetime.expenses),
    netCashFlow: round2(netCashFlow),
    savingsRate:
      currentTotals.income > 0 ? round2((savings / currentTotals.income) * 100) : 0,
    incomeChange: percentChange(currentTotals.income, previousTotals.income),
    expenseChange: percentChange(currentTotals.expenses, previousTotals.expenses),
    savingsChange: percentChange(savings, previousSavings),
    netCashFlowChange: percentChange(netCashFlow, previousNetCashFlow),
    transactionCount: count,
  };
}

export async function getCategoryBreakdown(
  userId: string,
  start: Date,
  end: Date,
  type: "INCOME" | "EXPENSE" = "EXPENSE",
): Promise<CategoryBreakdownItem[]> {
  const grouped = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { userId, type, date: { gte: start, lt: end } },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  if (grouped.length === 0) return [];

  const categories = await prisma.category.findMany({
    where: { id: { in: grouped.map((row) => row.categoryId) } },
    select: {
      id: true,
      name: true,
      icon: true,
      gradientFrom: true,
      gradientTo: true,
    },
  });

  const lookup = new Map(categories.map((category) => [category.id, category]));
  const total = grouped.reduce(
    (acc, row) => acc + (row._sum.amount ? Number(row._sum.amount) : 0),
    0,
  );

  return grouped
    .map((row) => {
      const category = lookup.get(row.categoryId);
      const amount = row._sum.amount ? Number(row._sum.amount) : 0;
      return {
        categoryId: row.categoryId,
        name: category?.name ?? "Uncategorised",
        icon: category?.icon ?? "Shapes",
        gradientFrom: category?.gradientFrom ?? "#7C3AED",
        gradientTo: category?.gradientTo ?? "#38BDF8",
        total: round2(amount),
        count: row._count._all,
        share: total > 0 ? round2((amount / total) * 100) : 0,
      };
    })
    .filter((item) => item.total > 0);
}

/**
 * Income / expense / net per month.
 *
 * One query covering the whole window, bucketed in memory — far cheaper than
 * `count` separate round-trips per month.
 */
export async function getMonthlyTrend(
  userId: string,
  months = 12,
  reference = new Date(),
): Promise<MonthlyTrendPoint[]> {
  const buckets = lastNMonths(months, reference);
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;

  const rows = await prisma.transaction.findMany({
    where: { userId, date: { gte: start, lt: end } },
    select: { type: true, amount: true, date: true },
  });

  const tally = new Map<string, { income: number; expenses: number }>();
  for (const bucket of buckets) {
    tally.set(`${bucket.year}-${bucket.month}`, { income: 0, expenses: 0 });
  }

  for (const row of rows) {
    const key = `${row.date.getUTCFullYear()}-${row.date.getUTCMonth() + 1}`;
    const bucket = tally.get(key);
    if (!bucket) continue;
    const amount = Number(row.amount);
    if (row.type === "INCOME") bucket.income += amount;
    else bucket.expenses += amount;
  }

  return buckets.map((bucket) => {
    const values = tally.get(`${bucket.year}-${bucket.month}`) ?? {
      income: 0,
      expenses: 0,
    };
    const net = values.income - values.expenses;
    return {
      key: `${bucket.year}-${String(bucket.month).padStart(2, "0")}`,
      label: bucket.label,
      longLabel: bucket.longLabel,
      income: round2(values.income),
      expenses: round2(values.expenses),
      net: round2(net),
      savingsRate: values.income > 0 ? round2((net / values.income) * 100) : 0,
    };
  });
}

/** Per-day income/expense buckets across an arbitrary window. */
export async function getDailySeries(
  userId: string,
  start: Date,
  end: Date,
  labelFormat = "EEE",
): Promise<DailyPoint[]> {
  const rows = await prisma.transaction.findMany({
    where: { userId, date: { gte: start, lt: end } },
    select: { type: true, amount: true, date: true },
  });

  const tally = new Map<string, { income: number; expenses: number }>();

  const cursor = new Date(start);
  while (cursor.getTime() < end.getTime()) {
    tally.set(cursor.toISOString().slice(0, 10), { income: 0, expenses: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10);
    const bucket = tally.get(key);
    if (!bucket) continue;
    const amount = Number(row.amount);
    if (row.type === "INCOME") bucket.income += amount;
    else bucket.expenses += amount;
  }

  return Array.from(tally.entries()).map(([key, values]) => {
    const [y, m, d] = key.split("-").map(Number);
    return {
      date: key,
      label: format(new Date(y, m - 1, d), labelFormat),
      income: round2(values.income),
      expenses: round2(values.expenses),
      net: round2(values.income - values.expenses),
    };
  });
}

export async function getWeeklySpending(
  userId: string,
  weekStartsOn: 0 | 1 = 0,
  reference = new Date(),
): Promise<DailyPoint[]> {
  const { start, end } = weekRange(reference, weekStartsOn);
  return getDailySeries(userId, start, end, "EEE");
}

/**
 * Running balance over time — the "net worth" curve.
 *
 * Seeded with everything before the window so the line starts at the true
 * balance rather than at zero.
 */
export async function getNetWorthSeries(
  userId: string,
  months = 12,
  reference = new Date(),
): Promise<CumulativePoint[]> {
  const buckets = lastNMonths(months, reference);
  const start = buckets[0].start;

  const [opening, trend] = await Promise.all([
    allTimeTotals(userId, start),
    getMonthlyTrend(userId, months, reference),
  ]);

  let running = opening.income - opening.expenses;

  return trend.map((point) => {
    running += point.net;
    return {
      date: point.key,
      label: point.label,
      value: round2(running),
    };
  });
}

/** Cumulative savings (goal contributions) over the same monthly buckets. */
export async function getSavingsGrowth(
  userId: string,
  months = 12,
  reference = new Date(),
): Promise<CumulativePoint[]> {
  const buckets = lastNMonths(months, reference);
  const start = buckets[0].start;

  const [prior, rows] = await Promise.all([
    prisma.goalContribution.aggregate({
      where: { userId, date: { lt: start } },
      _sum: { amount: true },
    }),
    prisma.goalContribution.findMany({
      where: { userId, date: { gte: start } },
      select: { amount: true, date: true },
    }),
  ]);

  const tally = new Map<string, number>();
  for (const bucket of buckets) {
    tally.set(`${bucket.year}-${bucket.month}`, 0);
  }

  for (const row of rows) {
    const key = `${row.date.getUTCFullYear()}-${row.date.getUTCMonth() + 1}`;
    if (!tally.has(key)) continue;
    tally.set(key, (tally.get(key) ?? 0) + Number(row.amount));
  }

  let running = prior._sum.amount ? Number(prior._sum.amount) : 0;

  return buckets.map((bucket) => {
    running += tally.get(`${bucket.year}-${bucket.month}`) ?? 0;
    return { date: `${bucket.year}-${bucket.month}`, label: bucket.label, value: round2(running) };
  });
}

/** Where a month sits in its own cycle, for pace projections. */
export function monthProgress(year: number, month: number, now = new Date()) {
  const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1));
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() + 1 === month;
  const dayOfMonth = isCurrentMonth ? now.getDate() : daysInMonth;
  return { dayOfMonth, daysInMonth, isCurrentMonth };
}

/** Average spend per weekday across a window — feeds the analytics heat strip. */
export async function getWeekdayAverages(
  userId: string,
  months = 3,
  reference = new Date(),
) {
  const buckets = lastNMonths(months, reference);
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;

  const rows = await prisma.transaction.findMany({
    where: { userId, type: "EXPENSE", date: { gte: start, lt: end } },
    select: { amount: true, date: true },
  });

  const totals = Array.from({ length: 7 }, () => ({ total: 0, days: new Set<string>() }));

  for (const row of rows) {
    const weekday = row.date.getUTCDay();
    totals[weekday].total += Number(row.amount);
    totals[weekday].days.add(row.date.toISOString().slice(0, 10));
  }

  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return totals.map((entry, index) => ({
    label: labels[index],
    total: round2(entry.total),
    average: entry.days.size > 0 ? round2(entry.total / entry.days.size) : 0,
  }));
}
