import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/utils";
import type { ActivityDTO, NotificationDTO } from "@/types";

export async function getActivities(
  userId: string,
  take = 12,
): Promise<ActivityDTO[]> {
  const rows = await prisma.activity.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    summary: row.summary,
    amount: row.amount === null ? null : round2(Number(row.amount)),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getNotifications(
  userId: string,
  take = 20,
): Promise<NotificationDTO[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    href: row.href,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

/**
 * Appends to the activity timeline. Never throws into the caller's path — a
 * failed audit write must not roll back a successful user action.
 */
export async function logActivity(input: {
  userId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  amount?: number | null;
}): Promise<void> {
  try {
    await prisma.activity.create({
      data: {
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
        amount: input.amount ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to record activity", error);
  }
}

export async function notify(input: {
  userId: string;
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "DANGER";
  href?: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type ?? "INFO",
        href: input.href ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to create notification", error);
  }
}
