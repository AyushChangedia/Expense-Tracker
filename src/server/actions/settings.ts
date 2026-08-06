"use server";

import { revalidatePath } from "next/cache";

import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  deleteAccountSchema,
  preferencesSchema,
  profileSchema,
} from "@/lib/validations";
import { CURRENCIES } from "@/lib/currency";
import { logActivity } from "@/server/queries/activity";
import { ActionError, parseInput, runAction } from "@/server/actions/helpers";
import type { ActionResult, UserPreferences } from "@/types";

export async function updateProfile(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(profileSchema, input);

    await prisma.user.update({
      where: { id: userId },
      data: { name: data.name, image: data.image || null },
    });

    await logActivity({
      userId,
      action: "updated",
      entity: "profile",
      summary: "Updated profile details",
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return undefined;
  }, "Profile updated");
}

export async function updatePreferences(
  input: unknown,
): Promise<ActionResult<UserPreferences>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(preferencesSchema, input);

    const currency = data.currency.toUpperCase();
    const known = CURRENCIES.some((option) => option.code === currency);
    if (!known) {
      // Anything Intl can format is acceptable; anything else is rejected so
      // the whole app does not fall back to raw numbers later.
      try {
        new Intl.NumberFormat(data.locale, { style: "currency", currency }).format(1);
      } catch {
        throw new ActionError("That currency code is not supported.", {
          currency: ["That currency code is not supported."],
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        currency,
        dateFormat: data.dateFormat,
        locale: data.locale,
        weekStart: data.weekStart,
      },
      select: { currency: true, dateFormat: true, locale: true, weekStart: true },
    });

    // Every page formats money from these, so refresh the whole shell.
    revalidatePath("/", "layout");
    return updated;
  }, "Preferences saved");
}

export async function deleteAccount(input: unknown): Promise<ActionResult<undefined>> {
  const result = await runAction(async () => {
    const userId = await requireUserId();
    parseInput(deleteAccountSchema, input);

    // Every owned row cascades from the user record.
    await prisma.user.delete({ where: { id: userId } });
    return undefined;
  });

  if (!result.ok) return result;

  // Outside runAction: signOut throws a redirect, which must not be swallowed
  // and reported as a failure.
  await signOut({ redirectTo: "/" });
  return { ok: true, data: undefined };
}

/** Wipes transactional data but keeps the account and its categories. */
export async function clearAllData(
  input: unknown,
): Promise<ActionResult<{ transactions: number }>> {
  return runAction(async () => {
    const userId = await requireUserId();
    parseInput(deleteAccountSchema, input);

    const [transactions] = await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { userId } }),
      prisma.budget.deleteMany({ where: { userId } }),
      prisma.goalContribution.deleteMany({ where: { userId } }),
      prisma.goal.deleteMany({ where: { userId } }),
      prisma.recurringTransaction.deleteMany({ where: { userId } }),
      prisma.activity.deleteMany({ where: { userId } }),
      prisma.notification.deleteMany({ where: { userId } }),
    ]);

    revalidatePath("/", "layout");
    return { transactions: transactions.count };
  }, "All data cleared");
}
