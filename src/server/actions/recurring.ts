"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { toUtcDay } from "@/lib/dates";
import { computeNextRunDate, runDueRecurring } from "@/lib/recurring";
import { toDecimal } from "@/lib/serialize";
import { requireUserId } from "@/lib/session";
import { recurringSchema, updateRecurringSchema } from "@/lib/validations";
import { logActivity } from "@/server/queries/activity";
import { ActionError, parseInput, runAction } from "@/server/actions/helpers";
import type { ActionResult } from "@/types";

function revalidateRecurring() {
  revalidatePath("/recurring");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/analytics");
}

async function assertCategoryOwned(userId: string, categoryId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });
  if (!category) {
    throw new ActionError("Pick a category from your list.", {
      categoryId: ["Pick a category from your list."],
    });
  }
}

export async function createRecurring(
  input: unknown,
): Promise<ActionResult<{ id: string; generated: number }>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(recurringSchema, input);

    await assertCategoryOwned(userId, data.categoryId);

    const startDate = toUtcDay(data.startDate);
    const nextRunDate = computeNextRunDate(startDate, data.frequency, data.interval);

    const created = await prisma.recurringTransaction.create({
      data: {
        userId,
        categoryId: data.categoryId,
        type: data.type,
        amount: toDecimal(data.amount),
        description: data.description,
        notes: data.notes || null,
        frequency: data.frequency,
        interval: data.interval,
        startDate,
        endDate: data.endDate ? toUtcDay(data.endDate) : null,
        nextRunDate,
        isActive: data.isActive,
      },
      select: { id: true },
    });

    await logActivity({
      userId,
      action: "created",
      entity: "recurring",
      entityId: created.id,
      summary: `Created recurring "${data.description}"`,
      amount: data.amount,
    });

    // A rule that starts in the past should immediately post its backlog,
    // rather than waiting for the next page load to look correct.
    const { created: generated } = data.isActive
      ? await runDueRecurring(userId)
      : { created: 0 };

    revalidateRecurring();
    return { id: created.id, generated };
  }, "Recurring transaction created");
}

export async function updateRecurring(
  input: unknown,
): Promise<ActionResult<{ id: string; generated: number }>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(updateRecurringSchema, input);

    const existing = await prisma.recurringTransaction.findFirst({
      where: { id: data.id, userId },
      select: {
        id: true,
        startDate: true,
        frequency: true,
        interval: true,
        nextRunDate: true,
      },
    });
    if (!existing) throw new ActionError("We could not find that recurring rule.");

    await assertCategoryOwned(userId, data.categoryId);

    const startDate = toUtcDay(data.startDate);

    // Only recompute the schedule when the cadence actually moved — otherwise
    // editing the amount would silently replay the backlog.
    const scheduleChanged =
      existing.startDate.getTime() !== startDate.getTime() ||
      existing.frequency !== data.frequency ||
      existing.interval !== data.interval;

    const nextRunDate = scheduleChanged
      ? computeNextRunDate(startDate, data.frequency, data.interval)
      : existing.nextRunDate;

    await prisma.recurringTransaction.update({
      where: { id: data.id },
      data: {
        categoryId: data.categoryId,
        type: data.type,
        amount: toDecimal(data.amount),
        description: data.description,
        notes: data.notes || null,
        frequency: data.frequency,
        interval: data.interval,
        startDate,
        endDate: data.endDate ? toUtcDay(data.endDate) : null,
        nextRunDate,
        isActive: data.isActive,
      },
    });

    await logActivity({
      userId,
      action: "updated",
      entity: "recurring",
      entityId: data.id,
      summary: `Updated recurring "${data.description}"`,
      amount: data.amount,
    });

    const { created: generated } = data.isActive
      ? await runDueRecurring(userId)
      : { created: 0 };

    revalidateRecurring();
    return { id: data.id, generated };
  }, "Recurring transaction updated");
}

export async function deleteRecurring(
  id: string,
  options: { deleteGenerated?: boolean } = {},
): Promise<ActionResult<string>> {
  return runAction(async () => {
    const userId = await requireUserId();

    const rule = await prisma.recurringTransaction.findFirst({
      where: { id, userId },
      select: { id: true, description: true },
    });
    if (!rule) throw new ActionError("We could not find that recurring rule.");

    if (options.deleteGenerated) {
      await prisma.transaction.deleteMany({ where: { userId, recurringId: id } });
    }

    // Generated transactions survive by default — `recurringId` is
    // `onDelete: SetNull`, so the history stays intact.
    await prisma.recurringTransaction.delete({ where: { id } });

    await logActivity({
      userId,
      action: "deleted",
      entity: "recurring",
      entityId: id,
      summary: `Deleted recurring "${rule.description}"`,
    });

    revalidateRecurring();
    return id;
  }, "Recurring transaction deleted");
}

export async function toggleRecurringActive(
  id: string,
): Promise<ActionResult<boolean>> {
  return runAction(async () => {
    const userId = await requireUserId();

    const rule = await prisma.recurringTransaction.findFirst({
      where: { id, userId },
      select: { id: true, isActive: true, frequency: true, interval: true, startDate: true },
    });
    if (!rule) throw new ActionError("We could not find that recurring rule.");

    const nextActive = !rule.isActive;

    await prisma.recurringTransaction.update({
      where: { id },
      data: {
        isActive: nextActive,
        // Resuming picks up from today rather than replaying the paused window.
        ...(nextActive
          ? { nextRunDate: computeNextRunDate(new Date(), rule.frequency, rule.interval) }
          : {}),
      },
    });

    if (nextActive) await runDueRecurring(userId);

    revalidateRecurring();
    return nextActive;
  });
}

/** Manual "run now" for the recurring page. */
export async function runRecurringNow(): Promise<ActionResult<number>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const { created } = await runDueRecurring(userId);
    revalidateRecurring();
    return created;
  });
}
