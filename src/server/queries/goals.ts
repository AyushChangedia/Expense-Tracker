import { differenceInCalendarDays } from "date-fns";

import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/utils";
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
    const remaining = round2(Math.max(0, target - current));
    const percentComplete = target > 0 ? round2(Math.min(100, (current / target) * 100)) : 0;

    const daysLeft = goal.deadline
      ? differenceInCalendarDays(goal.deadline, now)
      : null;

    // Months remaining, floored at one so the figure stays meaningful in the
    // final weeks rather than exploding towards infinity.
    let requiredPerMonth: number | null = null;
    if (goal.deadline && remaining > 0 && daysLeft !== null) {
      const monthsLeft = Math.max(1, daysLeft / 30.44);
      requiredPerMonth = round2(remaining / monthsLeft);
    }

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
      percentComplete,
      remaining,
      daysLeft,
      requiredPerMonth,
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
