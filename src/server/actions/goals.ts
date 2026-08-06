"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/serialize";
import { requireUserId } from "@/lib/session";
import { goalContributionSchema, goalSchema, updateGoalSchema } from "@/lib/validations";
import { logActivity, notify } from "@/server/queries/activity";
import { ActionError, parseInput, runAction } from "@/server/actions/helpers";
import type { ActionResult } from "@/types";

function revalidateGoals() {
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

export async function createGoal(input: unknown): Promise<ActionResult<string>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(goalSchema, input);

    if (data.currentAmount > data.targetAmount) {
      throw new ActionError("Starting amount cannot exceed the target.", {
        currentAmount: ["Starting amount cannot exceed the target."],
      });
    }

    const created = await prisma.goal.create({
      data: {
        userId,
        name: data.name,
        targetAmount: toDecimal(data.targetAmount),
        currentAmount: toDecimal(data.currentAmount),
        deadline: data.deadline ?? null,
        icon: data.icon,
        gradientFrom: data.gradientFrom,
        gradientTo: data.gradientTo,
        notes: data.notes || null,
        status: data.currentAmount >= data.targetAmount ? "COMPLETED" : "ACTIVE",
      },
      select: { id: true },
    });

    // A non-zero starting balance is a contribution — record it so the savings
    // growth chart starts from the right place.
    if (data.currentAmount > 0) {
      await prisma.goalContribution.create({
        data: {
          goalId: created.id,
          userId,
          amount: toDecimal(data.currentAmount),
          note: "Starting balance",
        },
      });
    }

    await logActivity({
      userId,
      action: "created",
      entity: "goal",
      entityId: created.id,
      summary: `Created goal "${data.name}"`,
      amount: data.targetAmount,
    });

    revalidateGoals();
    return created.id;
  }, "Goal created");
}

export async function updateGoal(input: unknown): Promise<ActionResult<string>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(updateGoalSchema, input);

    const existing = await prisma.goal.findFirst({
      where: { id: data.id, userId },
      select: { id: true, status: true },
    });
    if (!existing) throw new ActionError("We could not find that goal.");

    await prisma.goal.update({
      where: { id: data.id },
      data: {
        name: data.name,
        targetAmount: toDecimal(data.targetAmount),
        currentAmount: toDecimal(data.currentAmount),
        deadline: data.deadline ?? null,
        icon: data.icon,
        gradientFrom: data.gradientFrom,
        gradientTo: data.gradientTo,
        notes: data.notes || null,
        status:
          existing.status === "ARCHIVED"
            ? "ARCHIVED"
            : data.currentAmount >= data.targetAmount
              ? "COMPLETED"
              : "ACTIVE",
      },
    });

    await logActivity({
      userId,
      action: "updated",
      entity: "goal",
      entityId: data.id,
      summary: `Updated goal "${data.name}"`,
    });

    revalidateGoals();
    return data.id;
  }, "Goal updated");
}

export async function deleteGoal(id: string): Promise<ActionResult<string>> {
  return runAction(async () => {
    const userId = await requireUserId();

    const goal = await prisma.goal.findFirst({
      where: { id, userId },
      select: { id: true, name: true },
    });
    if (!goal) throw new ActionError("We could not find that goal.");

    await prisma.goal.delete({ where: { id } });

    await logActivity({
      userId,
      action: "deleted",
      entity: "goal",
      entityId: id,
      summary: `Deleted goal "${goal.name}"`,
    });

    revalidateGoals();
    return id;
  }, "Goal deleted");
}

export async function contributeToGoal(
  input: unknown,
): Promise<ActionResult<{ id: string; currentAmount: number; completed: boolean }>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(goalContributionSchema, input);

    const goal = await prisma.goal.findFirst({
      where: { id: data.goalId, userId },
      select: {
        id: true,
        name: true,
        targetAmount: true,
        currentAmount: true,
        status: true,
      },
    });
    if (!goal) throw new ActionError("We could not find that goal.");
    if (goal.status === "ARCHIVED") {
      throw new ActionError("Reactivate this goal before adding to it.");
    }

    const target = Number(goal.targetAmount);
    const nextAmount = Number(goal.currentAmount) + data.amount;
    const completed = nextAmount >= target;

    await prisma.$transaction([
      prisma.goalContribution.create({
        data: {
          goalId: goal.id,
          userId,
          amount: toDecimal(data.amount),
          note: data.note || null,
        },
      }),
      prisma.goal.update({
        where: { id: goal.id },
        data: {
          currentAmount: toDecimal(nextAmount),
          status: completed ? "COMPLETED" : "ACTIVE",
        },
      }),
    ]);

    await logActivity({
      userId,
      action: "updated",
      entity: "goal",
      entityId: goal.id,
      summary: `Added to "${goal.name}"`,
      amount: data.amount,
    });

    if (completed && goal.status !== "COMPLETED") {
      await notify({
        userId,
        title: "Goal reached",
        message: `"${goal.name}" is fully funded. Nice work.`,
        type: "SUCCESS",
        href: "/goals",
      });
    }

    revalidateGoals();
    return { id: goal.id, currentAmount: nextAmount, completed };
  }, "Contribution added");
}

export async function setGoalStatus(
  id: string,
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED",
): Promise<ActionResult<string>> {
  return runAction(async () => {
    const userId = await requireUserId();

    const goal = await prisma.goal.findFirst({
      where: { id, userId },
      select: { id: true, name: true },
    });
    if (!goal) throw new ActionError("We could not find that goal.");

    await prisma.goal.update({ where: { id }, data: { status } });

    revalidateGoals();
    return id;
  }, "Goal updated");
}
