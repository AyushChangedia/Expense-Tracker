import { round2 } from "@/lib/utils";
import type { BudgetProgress } from "@/types";

/**
 * The arithmetic behind a budget card.
 *
 * Every number here is one a person acts on: how much is left, what they can
 * spend today, where the month is heading. None of it needs a database, and it
 * lived inside getBudgetProgress, which does — so none of it could be run.
 *
 * It also has to behave at the edges of a month, which is exactly where a
 * query test with a seeded database is least likely to look.
 */

/** Below this share of the budget a category is healthy; above it, warned. */
export const WARNING_THRESHOLD = 80;

export type BudgetStanding = {
  spent: number;
  remaining: number;
  percentUsed: number;
  status: BudgetProgress["status"];
  dailyAllowance: number;
  projectedSpend: number;
};

/** How much of the budget has gone, as a percentage. */
export function percentUsed(spent: number, amount: number): number {
  return amount > 0 ? round2((spent / amount) * 100) : 0;
}

/**
 * Healthy, warning or exceeded.
 *
 * Measured on the rounded percentage the card displays, so a budget shown as
 * 100% is never labelled healthy.
 */
export function statusFor(percent: number): BudgetProgress["status"] {
  if (percent >= 100) return "exceeded";
  if (percent >= WARNING_THRESHOLD) return "warning";
  return "healthy";
}

/** How many days of the month are left to spend in. */
export function daysLeftInMonth(dayOfMonth: number, daysInMonth: number): number {
  return Math.max(0, daysInMonth - dayOfMonth);
}

/** What is left, spread evenly across the days that remain. */
export function dailyAllowance(remaining: number, daysRemaining: number): number {
  if (daysRemaining <= 0) return 0;
  return round2(Math.max(0, remaining) / daysRemaining);
}

/**
 * Where this month lands if the pace so far holds.
 *
 * Straight-line, and deliberately so: anything cleverer would need a history
 * this figure does not have, and would be harder to explain on a card.
 */
export function projectedSpend(
  spent: number,
  dayOfMonth: number,
  daysInMonth: number,
): number {
  if (dayOfMonth <= 0) return round2(spent);
  return round2((spent / dayOfMonth) * daysInMonth);
}

/** Every derived figure on one budget, from the spend against it. */
export function standing(
  amount: number,
  rawSpent: number,
  dayOfMonth: number,
  daysInMonth: number,
): BudgetStanding {
  const spent = round2(rawSpent);
  const remaining = round2(amount - spent);
  const percent = percentUsed(spent, amount);

  return {
    spent,
    remaining,
    percentUsed: percent,
    status: statusFor(percent),
    dailyAllowance: dailyAllowance(remaining, daysLeftInMonth(dayOfMonth, daysInMonth)),
    projectedSpend: projectedSpend(spent, dayOfMonth, daysInMonth),
  };
}
