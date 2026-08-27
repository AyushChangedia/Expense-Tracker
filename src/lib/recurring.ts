import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { advanceRecurrence, toUtcDay, utcDayOf } from "@/lib/dates";

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
      startDate: true,
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

    // The rule's own start day, so a monthly rule due on the 31st keeps paying
    // on the 31st. Stepping from the previous cursor instead lets February
    // pull the whole sequence back to the 28th permanently.
    const anchorDay = utcDayOf(rule.startDate).getUTCDate();

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
        date: utcDayOf(cursor),
        recurringId: rule.id,
      });

      lastRun = cursor;
      cursor = advanceRecurrence(cursor, rule.frequency, rule.interval, anchorDay);
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
 * The date a rule should next post on, used when it is created or its schedule
 * is edited.
 *
 * For a start date in the future, that is the start date itself. For one in
 * the past it is the **most recent occurrence at or before today** — not,
 * despite how the old wording read, the first occurrence on or after the
 * start. A rule created today with a start date in January posts once and
 * then continues monthly; it does not back-fill the eight months in between,
 * which is what walking from the start date would do and is rarely what
 * anyone means when they set an old start date on a rule they have only just
 * created.
 */
export function computeNextRunDate(
  startDate: Date,
  frequency: Prisma.RecurringTransactionCreateInput["frequency"],
  interval: number,
  now = new Date(),
): Date {
  const today = toUtcDay(now);
  // startDate has already been through toUtcDay at the call site.
  let cursor = utcDayOf(startDate);
  let guard = 0;

  const anchorDay = cursor.getUTCDate();

  // A start date in the future is itself the next run.
  if (cursor.getTime() >= today.getTime()) return cursor;

  // Otherwise walk forward on the rule's own cadence and stop at the last
  // occurrence that is not in the future, so the rule keeps its original
  // phase — the 3rd of the month stays the 3rd — rather than resetting to
  // today. runDueRecurring posts that occurrence on the next page load.
  while (cursor.getTime() < today.getTime() && guard < MAX_OCCURRENCES_PER_RULE * 4) {
    const next = advanceRecurrence(cursor, frequency, interval, anchorDay);
    if (next.getTime() > today.getTime()) break;
    cursor = next;
    guard += 1;
  }

  return cursor;
}
