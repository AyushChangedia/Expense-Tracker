import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { advanceRecurrence, toUtcDay } from "@/lib/dates";

/** Stops a badly-configured daily rule from generating thousands of rows. */
const MAX_OCCURRENCES_PER_RULE = 260;

export type RecurringRunResult = {
  created: number;
  rules: number;
};

/**
 * Materialises every recurring rule that has come due.
 *
 * Called from the dashboard and transactions pages rather than a cron job, so
 * the app stays a single deployable unit with no external scheduler. The query
 * is indexed on `nextRunDate` and returns nothing on the overwhelming majority
 * of page loads, so the cost is one cheap lookup.
 *
 * Idempotent: `nextRunDate` advances inside the same transaction that inserts
 * the rows, so a double invocation cannot double-post.
 */
export async function runDueRecurring(
  userId: string,
  now = new Date(),
): Promise<RecurringRunResult> {
  const today = toUtcDay(now);

  const due = await prisma.recurringTransaction.findMany({
    where: {
      userId,
      isActive: true,
      nextRunDate: { lte: today },
    },
    select: {
      id: true,
      userId: true,
      categoryId: true,
      type: true,
      amount: true,
      description: true,
      notes: true,
      frequency: true,
      interval: true,
      endDate: true,
      nextRunDate: true,
    },
  });

  if (due.length === 0) return { created: 0, rules: 0 };

  let created = 0;
  let touchedRules = 0;

  for (const rule of due) {
    const rows: Prisma.TransactionCreateManyInput[] = [];
    let cursor = rule.nextRunDate;
    let lastRun: Date | null = null;
    let guard = 0;

    while (
      cursor.getTime() <= today.getTime() &&
      guard < MAX_OCCURRENCES_PER_RULE &&
      (!rule.endDate || cursor.getTime() <= rule.endDate.getTime())
    ) {
      rows.push({
        userId: rule.userId,
        categoryId: rule.categoryId,
        type: rule.type,
        amount: rule.amount,
        description: rule.description,
        notes: rule.notes,
        date: toUtcDay(cursor),
        recurringId: rule.id,
      });

      lastRun = cursor;
      cursor = toUtcDay(advanceRecurrence(cursor, rule.frequency, rule.interval));
      guard += 1;
    }

    if (rows.length === 0) {
      // Past its end date but still flagged active — retire it.
      if (rule.endDate && cursor.getTime() > rule.endDate.getTime()) {
        await prisma.recurringTransaction.update({
          where: { id: rule.id },
          data: { isActive: false },
        });
      }
      continue;
    }

    const exhausted = Boolean(rule.endDate && cursor.getTime() > rule.endDate.getTime());

    await prisma.$transaction([
      prisma.transaction.createMany({ data: rows }),
      prisma.recurringTransaction.update({
        where: { id: rule.id },
        data: {
          nextRunDate: cursor,
          lastRunDate: lastRun,
          isActive: !exhausted,
        },
      }),
      prisma.activity.create({
        data: {
          userId: rule.userId,
          action: "generated",
          entity: "recurring",
          entityId: rule.id,
          summary: `${rows.length} recurring ${rows.length === 1 ? "entry" : "entries"} posted for "${rule.description}"`,
          amount: rule.amount,
        },
      }),
      prisma.notification.create({
        data: {
          userId: rule.userId,
          title: "Recurring transactions posted",
          message: `${rows.length} × ${rule.description} ${rows.length === 1 ? "was" : "were"} added automatically.`,
          type: "INFO",
          href: "/recurring",
        },
      }),
    ]);

    created += rows.length;
    touchedRules += 1;
  }

  return { created, rules: touchedRules };
}

/**
 * The first run date on or after `startDate`, used when a rule is created or
 * its schedule is edited.
 */
export function computeNextRunDate(
  startDate: Date,
  frequency: Prisma.RecurringTransactionCreateInput["frequency"],
  interval: number,
  now = new Date(),
): Date {
  const today = toUtcDay(now);
  let cursor = toUtcDay(startDate);
  let guard = 0;

  // A start date in the future is itself the next run.
  if (cursor.getTime() >= today.getTime()) return cursor;

  // Otherwise walk forward — the backlog is posted by runDueRecurring, so the
  // rule keeps its original cadence rather than resetting to today.
  while (cursor.getTime() < today.getTime() && guard < MAX_OCCURRENCES_PER_RULE * 4) {
    const next = toUtcDay(advanceRecurrence(cursor, frequency, interval));
    if (next.getTime() > today.getTime()) break;
    cursor = next;
    guard += 1;
  }

  return cursor;
}
