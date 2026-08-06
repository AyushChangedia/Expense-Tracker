"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { runAction } from "@/server/actions/helpers";
import { getNotifications } from "@/server/queries/activity";
import type { ActionResult, NotificationDTO } from "@/types";

export async function fetchNotifications(): Promise<ActionResult<NotificationDTO[]>> {
  return runAction(async () => {
    const userId = await requireUserId();
    return getNotifications(userId, 20);
  });
}

export async function markNotificationRead(
  id: string,
): Promise<ActionResult<string>> {
  return runAction(async () => {
    const userId = await requireUserId();
    await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
    revalidatePath("/dashboard");
    return id;
  });
}

export async function markAllNotificationsRead(): Promise<ActionResult<number>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    revalidatePath("/dashboard");
    return result.count;
  });
}

export async function clearNotifications(): Promise<ActionResult<number>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const result = await prisma.notification.deleteMany({ where: { userId } });
    revalidatePath("/dashboard");
    return result.count;
  });
}
