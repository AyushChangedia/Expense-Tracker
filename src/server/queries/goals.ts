import { differenceInCalendarDays } from "date-fns";

import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/utils";
import { standing } from "@/lib/goal-math";
import type { GoalDTO } from "@/types";

/** Derives progress, urgency, and the monthly contribution needed to land on time. */
export async function getGoals(
  userId: string,
  now = new Date(),
): Promise<GoalDTO[]> {
  const goals = await prisma.goal.findMany({
    where: { userId },
    include: {
      contributions: {
        select: { id: true, amount: true, date: true, note: true },
        orderBy: { date: "desc" },
        take: 20,
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return goals.map((goal) => {
    const target = Number(goal.targetAmount);
    const current = Number(goal.currentAmount);

    const daysLeft = goal.deadline
      ? differenceInCalendarDays(goal.deadline, now)
      : null;

    return {
      id: goal.id,
      name: goal.name,
      targetAmount: round2(target),
      currentAmount: round2(current),
      deadline: goal.deadline ? goal.deadline.toISOString() : null,
      icon: goal.icon,
      gradientFrom: goal.gradientFrom,
      gradientTo: goal.gradientTo,
      status: goal.status,
      notes: goal.notes,
      createdAt: goal.createdAt.toISOString(),
      daysLeft,
      ...standing(current, target, daysLeft),
      contributions: goal.contributions.map((contribution) => ({
        id: contribution.id,
        amount: round2(Number(contribution.amount)),
        date: contribution.date.toISOString(),
        note: contribution.note,
      })),
    };
  });
}

export async function getActiveGoals(userId: string, take = 3): Promise<GoalDTO[]> {
  const goals = await getGoals(userId);
  return goals.filter((goal) => goal.status === "ACTIVE").slice(0, take);
}
