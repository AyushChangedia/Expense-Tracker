import { round2 } from "@/lib/utils";

/**
 * The arithmetic behind a savings goal.
 *
 * A goal card answers one question — am I going to get there, and what will it
 * take each month — and the answer has to stay sensible in the two cases nobody
 * builds for: a deadline that is today, and a deadline that has passed.
 *
 * Lifted out of getGoals, which needs a database, so none of it could be run.
 */

/** Days in an average month. The deadline maths is calendar-agnostic. */
export const DAYS_PER_MONTH = 30.44;

/** How much of the goal is done, capped at complete. */
export function percentComplete(current: number, target: number): number {
  if (target <= 0) return 0;
  return round2(Math.min(100, (current / target) * 100));
}

/** What is still to be saved. Never negative: a goal cannot be over-reached. */
export function remainingFor(current: number, target: number): number {
  return round2(Math.max(0, target - current));
}

/**
 * What has to go in each month to land on the deadline.
 *
 * `null` when there is nothing to answer: no deadline, or nothing left to save.
 *
 * The month count is floored at one rather than at a fraction, because dividing
 * by the two weeks that are actually left produces a figure twice the size of
 * the sum needed — a "₹40,000 per month" on a goal that needs ₹20,000 by the
 * end of the fortnight. One month is the honest reading of "the rest of it,
 * soon".
 */
export function requiredPerMonth(
  remaining: number,
  daysLeft: number | null,
): number | null {
  if (daysLeft === null || remaining <= 0) return null;
  const monthsLeft = Math.max(1, daysLeft / DAYS_PER_MONTH);
  return round2(remaining / monthsLeft);
}

/** Where a goal stands: is it funded, is it late, is it still running? */
export type GoalPacing = "complete" | "overdue" | "due-today" | "on-track";

export function pacingFor(
  remaining: number,
  daysLeft: number | null,
): GoalPacing {
  if (remaining <= 0) return "complete";
  if (daysLeft === null) return "on-track";
  if (daysLeft < 0) return "overdue";
  if (daysLeft === 0) return "due-today";
  return "on-track";
}

export type GoalStanding = {
  percentComplete: number;
  remaining: number;
  requiredPerMonth: number | null;
  pacing: GoalPacing;
};

/** Every derived figure on one goal. */
export function standing(
  current: number,
  target: number,
  daysLeft: number | null,
): GoalStanding {
  const remaining = remainingFor(current, target);
  return {
    percentComplete: percentComplete(current, target),
    remaining,
    requiredPerMonth: requiredPerMonth(remaining, daysLeft),
    pacing: pacingFor(remaining, daysLeft),
  };
}
