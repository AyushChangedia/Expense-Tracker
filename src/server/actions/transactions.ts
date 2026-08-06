"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { toUtcDay } from "@/lib/dates";
import { slugify } from "@/lib/utils";
import { toDecimal } from "@/lib/serialize";
import { parseNaturalLanguage } from "@/lib/nlp";
import { requireUserId } from "@/lib/session";
import {
  bulkIdsSchema,
  naturalLanguageSchema,
  transactionIdSchema,
  transactionSchema,
  updateTransactionSchema,
} from "@/lib/validations";
import { logActivity } from "@/server/queries/activity";
import {
  getTransactionById,
  mapTransaction,
  transactionInclude,
} from "@/server/queries/transactions";
import { ActionError, parseInput, runAction } from "@/server/actions/helpers";
import type { ActionResult, ParsedTransactionDraft, TransactionDTO } from "@/types";

/** Pages whose data changes whenever a transaction does. */
const AFFECTED_PATHS = [
  "/dashboard",
  "/transactions",
  "/analytics",
  "/calendar",
  "/budgets",
  "/insights",
];

function revalidateAll() {
  for (const path of AFFECTED_PATHS) revalidatePath(path);
}

/**
 * Resolves tag names to tag ids, creating any that are new.
 *
 * Tags are matched on their slug so "Coffee", "coffee", and " coffee " all
 * land on the same record.
 */
async function resolveTagIds(userId: string, names: string[]): Promise<string[]> {
  const cleaned = Array.from(
    new Map(
      names
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => [slugify(name), name]),
    ).entries(),
  ).filter(([slug]) => slug.length > 0);

  if (cleaned.length === 0) return [];

  await prisma.tag.createMany({
    data: cleaned.map(([slug, name]) => ({ userId, slug, name })),
    skipDuplicates: true,
  });

  const tags = await prisma.tag.findMany({
    where: { userId, slug: { in: cleaned.map(([slug]) => slug) } },
    select: { id: true },
  });

  return tags.map((tag) => tag.id);
}

async function assertCategoryOwned(userId: string, categoryId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true, name: true },
  });
  if (!category) {
    throw new ActionError("Pick a category from your list.", {
      categoryId: ["Pick a category from your list."],
    });
  }
  return category;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createTransaction(
  input: unknown,
): Promise<ActionResult<TransactionDTO>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(transactionSchema, input);

    const category = await assertCategoryOwned(userId, data.categoryId);
    const tagIds = await resolveTagIds(userId, data.tags);

    const created = await prisma.transaction.create({
      data: {
        userId,
        categoryId: data.categoryId,
        type: data.type,
        amount: toDecimal(data.amount),
        description: data.description,
        notes: data.notes || null,
        date: toUtcDay(data.date),
        isPinned: data.isPinned,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: transactionInclude,
    });

    await logActivity({
      userId,
      action: "created",
      entity: "transaction",
      entityId: created.id,
      summary: `Added ${data.type === "INCOME" ? "income" : "expense"} "${data.description}" in ${category.name}`,
      amount: data.amount,
    });

    revalidateAll();
    return mapTransaction(created);
  }, "Transaction added");
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateTransaction(
  input: unknown,
): Promise<ActionResult<TransactionDTO>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(updateTransactionSchema, input);

    const existing = await prisma.transaction.findFirst({
      where: { id: data.id, userId },
      select: { id: true },
    });
    if (!existing) throw new ActionError("We could not find that transaction.");

    await assertCategoryOwned(userId, data.categoryId);
    const tagIds = await resolveTagIds(userId, data.tags);

    const updated = await prisma.$transaction(async (tx) => {
      // Replacing the join rows wholesale is simpler and cheaper than diffing
      // for the handful of tags a transaction can carry.
      await tx.transactionTag.deleteMany({ where: { transactionId: data.id } });

      return tx.transaction.update({
        where: { id: data.id },
        data: {
          categoryId: data.categoryId,
          type: data.type,
          amount: toDecimal(data.amount),
          description: data.description,
          notes: data.notes || null,
          date: toUtcDay(data.date),
          isPinned: data.isPinned,
          tags: { create: tagIds.map((tagId) => ({ tagId })) },
        },
        include: transactionInclude,
      });
    });

    await logActivity({
      userId,
      action: "updated",
      entity: "transaction",
      entityId: updated.id,
      summary: `Updated "${data.description}"`,
      amount: data.amount,
    });

    revalidateAll();
    return mapTransaction(updated);
  }, "Transaction updated");
}

// ---------------------------------------------------------------------------
// Delete + undo
// ---------------------------------------------------------------------------

/**
 * The payload needed to put a deleted transaction back exactly as it was —
 * returned to the client so the "Undo" toast can restore it.
 */
export type DeletedTransactionSnapshot = {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  notes: string | null;
  date: string;
  isPinned: boolean;
  categoryId: string;
  recurringId: string | null;
  tagIds: string[];
};

export async function deleteTransaction(
  input: unknown,
): Promise<ActionResult<DeletedTransactionSnapshot>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const { id } = parseInput(transactionIdSchema, input);

    const existing = await prisma.transaction.findFirst({
      where: { id, userId },
      include: { tags: { select: { tagId: true } } },
    });
    if (!existing) throw new ActionError("We could not find that transaction.");

    await prisma.transaction.delete({ where: { id } });

    await logActivity({
      userId,
      action: "deleted",
      entity: "transaction",
      entityId: id,
      summary: `Deleted "${existing.description}"`,
      amount: Number(existing.amount),
    });

    revalidateAll();

    return {
      id: existing.id,
      type: existing.type,
      amount: Number(existing.amount),
      description: existing.description,
      notes: existing.notes,
      date: existing.date.toISOString(),
      isPinned: existing.isPinned,
      categoryId: existing.categoryId,
      recurringId: existing.recurringId,
      tagIds: existing.tags.map((link) => link.tagId),
    } satisfies DeletedTransactionSnapshot;
  }, "Transaction deleted");
}

/**
 * Re-inserts deleted transactions, ids included, so undo is a true restore
 * rather than a lookalike copy.
 */
export async function restoreTransactions(
  snapshots: DeletedTransactionSnapshot[],
): Promise<ActionResult<number>> {
  return runAction(async () => {
    const userId = await requireUserId();
    if (!Array.isArray(snapshots) || snapshots.length === 0) {
      throw new ActionError("There is nothing to restore.");
    }

    // Only restore into categories and tags the user still owns — a category
    // deleted in the meantime would otherwise break the insert.
    const [categories, tags] = await Promise.all([
      prisma.category.findMany({
        where: { userId, id: { in: snapshots.map((item) => item.categoryId) } },
        select: { id: true },
      }),
      prisma.tag.findMany({
        where: { userId, id: { in: snapshots.flatMap((item) => item.tagIds) } },
        select: { id: true },
      }),
    ]);

    const validCategories = new Set(categories.map((category) => category.id));
    const validTags = new Set(tags.map((tag) => tag.id));

    const restorable = snapshots.filter((item) => validCategories.has(item.categoryId));
    if (restorable.length === 0) {
      throw new ActionError("The original category no longer exists.");
    }

    // Rules may have been deleted since; drop the link rather than fail.
    const ruleIds = Array.from(
      new Set(restorable.map((item) => item.recurringId).filter(Boolean) as string[]),
    );
    const rules = ruleIds.length
      ? await prisma.recurringTransaction.findMany({
          where: { userId, id: { in: ruleIds } },
          select: { id: true },
        })
      : [];
    const validRules = new Set(rules.map((rule) => rule.id));

    await prisma.$transaction([
      prisma.transaction.createMany({
        data: restorable.map((item) => ({
          id: item.id,
          userId,
          categoryId: item.categoryId,
          type: item.type,
          amount: toDecimal(item.amount),
          description: item.description,
          notes: item.notes,
          date: new Date(item.date),
          isPinned: item.isPinned,
          recurringId:
            item.recurringId && validRules.has(item.recurringId) ? item.recurringId : null,
        })),
        skipDuplicates: true,
      }),
      prisma.transactionTag.createMany({
        data: restorable.flatMap((item) =>
          item.tagIds
            .filter((tagId) => validTags.has(tagId))
            .map((tagId) => ({ transactionId: item.id, tagId })),
        ),
        skipDuplicates: true,
      }),
    ]);

    await logActivity({
      userId,
      action: "restored",
      entity: "transaction",
      summary:
        restorable.length === 1
          ? `Restored "${restorable[0].description}"`
          : `Restored ${restorable.length} transactions`,
    });

    revalidateAll();
    return restorable.length;
  }, "Restored");
}

export async function bulkDeleteTransactions(
  input: unknown,
): Promise<ActionResult<DeletedTransactionSnapshot[]>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const { ids } = parseInput(bulkIdsSchema, input);

    const existing = await prisma.transaction.findMany({
      where: { id: { in: ids }, userId },
      include: { tags: { select: { tagId: true } } },
    });

    if (existing.length === 0) {
      throw new ActionError("Those transactions are already gone.");
    }

    await prisma.transaction.deleteMany({
      where: { id: { in: existing.map((item) => item.id) }, userId },
    });

    await logActivity({
      userId,
      action: "deleted",
      entity: "transaction",
      summary: `Deleted ${existing.length} transactions`,
      amount: existing.reduce((acc, item) => acc + Number(item.amount), 0),
    });

    revalidateAll();

    return existing.map((item) => ({
      id: item.id,
      type: item.type,
      amount: Number(item.amount),
      description: item.description,
      notes: item.notes,
      date: item.date.toISOString(),
      isPinned: item.isPinned,
      categoryId: item.categoryId,
      recurringId: item.recurringId,
      tagIds: item.tags.map((link) => link.tagId),
    }));
  }, "Transactions deleted");
}

// ---------------------------------------------------------------------------
// Duplicate & pin
// ---------------------------------------------------------------------------

export async function duplicateTransaction(
  input: unknown,
): Promise<ActionResult<TransactionDTO>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const { id } = parseInput(transactionIdSchema, input);

    const source = await prisma.transaction.findFirst({
      where: { id, userId },
      include: { tags: { select: { tagId: true } } },
    });
    if (!source) throw new ActionError("We could not find that transaction.");

    const copy = await prisma.transaction.create({
      data: {
        userId,
        categoryId: source.categoryId,
        type: source.type,
        amount: source.amount,
        description: source.description,
        notes: source.notes,
        // The copy lands on today — duplicating is almost always "this again,
        // now" rather than "another one back then".
        date: toUtcDay(new Date()),
        isPinned: false,
        tags: { create: source.tags.map((link) => ({ tagId: link.tagId })) },
      },
      include: transactionInclude,
    });

    await logActivity({
      userId,
      action: "created",
      entity: "transaction",
      entityId: copy.id,
      summary: `Duplicated "${source.description}"`,
      amount: Number(source.amount),
    });

    revalidateAll();
    return mapTransaction(copy);
  }, "Transaction duplicated");
}

export async function toggleTransactionPin(
  input: unknown,
): Promise<ActionResult<TransactionDTO>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const { id } = parseInput(transactionIdSchema, input);

    const existing = await prisma.transaction.findFirst({
      where: { id, userId },
      select: { id: true, isPinned: true, description: true },
    });
    if (!existing) throw new ActionError("We could not find that transaction.");

    const updated = await prisma.transaction.update({
      where: { id },
      data: { isPinned: !existing.isPinned },
      include: transactionInclude,
    });

    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    return mapTransaction(updated);
  });
}

// ---------------------------------------------------------------------------
// Natural language quick add
// ---------------------------------------------------------------------------

/**
 * Parses free text into a draft without saving. The quick-add box calls this
 * as the user types so the preview stays honest about what will be created.
 */
export async function parseTransactionText(
  input: unknown,
): Promise<ActionResult<ParsedTransactionDraft>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const { text } = parseInput(naturalLanguageSchema, input);

    const draft = parseNaturalLanguage(text);

    // Map the guessed slug onto a category this user actually has.
    let categoryId: string | null = null;
    if (draft.categorySlug) {
      const category = await prisma.category.findFirst({
        where: { userId, slug: draft.categorySlug },
        select: { id: true },
      });
      categoryId = category?.id ?? null;
    }

    if (!categoryId) {
      const fallback = await prisma.category.findFirst({
        where: {
          userId,
          OR: [
            { slug: "other" },
            { kind: draft.type === "INCOME" ? "INCOME" : "EXPENSE" },
          ],
        },
        orderBy: { slug: "asc" },
        select: { id: true },
      });
      categoryId = fallback?.id ?? null;
    }

    return { ...draft, categoryId };
  });
}

/** Parse and save in one step — the Enter key path of the quick-add box. */
export async function createTransactionFromText(
  input: unknown,
): Promise<ActionResult<TransactionDTO>> {
  const parsed = await parseTransactionText(input);
  if (!parsed.ok) return parsed;

  const draft = parsed.data;

  if (draft.amount === null) {
    return {
      ok: false,
      error: 'No amount found — try "spent 25 on lunch yesterday".',
    };
  }
  if (!draft.categoryId) {
    return { ok: false, error: "No matching category. Add one first." };
  }

  return createTransaction({
    type: draft.type,
    amount: draft.amount,
    description: draft.description,
    categoryId: draft.categoryId,
    date: draft.date,
    tags: draft.tags,
    isPinned: false,
    notes: "",
  });
}

export async function fetchTransaction(
  id: string,
): Promise<ActionResult<TransactionDTO | null>> {
  return runAction(async () => {
    const userId = await requireUserId();
    return getTransactionById(userId, id);
  });
}
