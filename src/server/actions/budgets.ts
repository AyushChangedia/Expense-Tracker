"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { monthLabel } from "@/lib/dates";
import { toDecimal } from "@/lib/serialize";
import { requireUserId } from "@/lib/session";
import { budgetSchema, updateBudgetSchema } from "@/lib/validations";
import { logActivity } from "@/server/queries/activity";
import { ActionError, parseInput, runAction } from "@/server/actions/helpers";
import type { ActionResult } from "@/types";

function revalidateBudgets() {
  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

/**
 * Postgres treats NULLs as distinct in unique indexes, so the
 * `[userId, categoryId, month, year]` constraint does not stop a second
 * *overall* budget for the same month. Check explicitly instead.
 */
async function assertNoDuplicate(
  userId: string,
  categoryId: string | null,
  month: number,
  year: number,
  excludeId?: string,
) {
  const clash = await prisma.budget.findFirst({
    where: {
      userId,
      categoryId,
      month,
      year,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  if (clash) {
    throw new ActionError(
      categoryId
        ? "That category already has a budget for this month."
        : "You already have an overall budget for this month.",
    );
  }
}

export async function createBudget(input: unknown): Promise<ActionResult<string>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(budgetSchema, input);
    const categoryId = data.categoryId || null;

    let categoryName = "Overall";
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, userId },
        select: { name: true },
      });
      if (!category) {
        throw new ActionError("Pick a category from your list.", {
          categoryId: ["Pick a category from your list."],
        });
      }
      categoryName = category.name;
    }

    await assertNoDuplicate(userId, categoryId, data.month, data.year);

    const created = await prisma.budget.create({
      data: {
        userId,
        categoryId,
        amount: toDecimal(data.amount),
        month: data.month,
        year: data.year,
      },
      select: { id: true },
    });

    await logActivity({
      userId,
      action: "created",
      entity: "budget",
      entityId: created.id,
      summary: `Set a ${categoryName} budget for ${monthLabel(data.year, data.month)}`,
      amount: data.amount,
    });

    revalidateBudgets();
    return created.id;
  }, "Budget created");
}

export async function updateBudget(input: unknown): Promise<ActionResult<string>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(updateBudgetSchema, input);
    const categoryId = data.categoryId || null;

    const existing = await prisma.budget.findFirst({
      where: { id: data.id, userId },
      select: { id: true },
    });
    if (!existing) throw new ActionError("We could not find that budget.");

    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, userId },
        select: { id: true },
      });
      if (!category) throw new ActionError("Pick a category from your list.");
    }

    await assertNoDuplicate(userId, categoryId, data.month, data.year, data.id);

    await prisma.budget.update({
      where: { id: data.id },
      data: {
        categoryId,
        amount: toDecimal(data.amount),
        month: data.month,
        year: data.year,
      },
    });

    await logActivity({
      userId,
      action: "updated",
      entity: "budget",
      entityId: data.id,
      summary: `Updated a budget for ${monthLabel(data.year, data.month)}`,
      amount: data.amount,
    });

    revalidateBudgets();
    return data.id;
  }, "Budget updated");
}

export async function deleteBudget(id: string): Promise<ActionResult<string>> {
  return runAction(async () => {
    const userId = await requireUserId();

    const existing = await prisma.budget.findFirst({
      where: { id, userId },
      select: { id: true, month: true, year: true },
    });
    if (!existing) throw new ActionError("We could not find that budget.");

    await prisma.budget.delete({ where: { id } });

    await logActivity({
      userId,
      action: "deleted",
      entity: "budget",
      entityId: id,
      summary: `Removed a budget for ${monthLabel(existing.year, existing.month)}`,
    });

    revalidateBudgets();
    return id;
  }, "Budget deleted");
}

/**
 * Copies a month's budgets forward. Existing budgets in the target month are
 * left alone rather than overwritten.
 */
export async function copyBudgetsToMonth(input: {
  fromMonth: number;
  fromYear: number;
  toMonth: number;
  toYear: number;
}): Promise<ActionResult<number>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const { fromMonth, fromYear, toMonth, toYear } = input;

    if (fromMonth === toMonth && fromYear === toYear) {
      throw new ActionError("Pick a different month to copy into.");
    }

    const [source, target] = await Promise.all([
      prisma.budget.findMany({
        where: { userId, month: fromMonth, year: fromYear },
        select: { categoryId: true, amount: true },
      }),
      prisma.budget.findMany({
        where: { userId, month: toMonth, year: toYear },
        select: { categoryId: true },
      }),
    ]);

    if (source.length === 0) {
      throw new ActionError(`${monthLabel(fromYear, fromMonth)} has no budgets to copy.`);
    }

    const alreadyThere = new Set(target.map((budget) => budget.categoryId));
    const toCreate = source.filter((budget) => !alreadyThere.has(budget.categoryId));

    if (toCreate.length === 0) {
      throw new ActionError(`${monthLabel(toYear, toMonth)} already has those budgets.`);
    }

    await prisma.budget.createMany({
      data: toCreate.map((budget) => ({
        userId,
        categoryId: budget.categoryId,
        amount: budget.amount,
        month: toMonth,
        year: toYear,
      })),
      skipDuplicates: true,
    });

    await logActivity({
      userId,
      action: "created",
      entity: "budget",
      summary: `Copied ${toCreate.length} ${toCreate.length === 1 ? "budget" : "budgets"} into ${monthLabel(toYear, toMonth)}`,
    });

    revalidateBudgets();
    return toCreate.length;
  }, "Budgets copied");
}
