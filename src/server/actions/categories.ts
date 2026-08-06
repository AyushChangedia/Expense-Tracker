"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { categorySchema, tagSchema, updateCategorySchema } from "@/lib/validations";
import { logActivity } from "@/server/queries/activity";
import { ActionError, parseInput, runAction } from "@/server/actions/helpers";
import type { ActionResult, CategoryDTO, TagDTO } from "@/types";

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  kind: true,
  icon: true,
  gradientFrom: true,
  gradientTo: true,
  isDefault: true,
  isFavorite: true,
  sortOrder: true,
} as const;

function revalidateCategories() {
  revalidatePath("/categories");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  revalidatePath("/analytics");
}

/** Finds a slug that is free for this user: "travel", "travel-2", "travel-3". */
async function uniqueSlug(
  userId: string,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(name) || "category";
  let candidate = base;
  let suffix = 2;

  // The catalogue per user is small, so a short loop is cheaper than a
  // cleverer query.
  for (;;) {
    const clash = await prisma.category.findFirst({
      where: { userId, slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function createCategory(
  input: unknown,
): Promise<ActionResult<CategoryDTO>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(categorySchema, input);

    const slug = await uniqueSlug(userId, data.name);
    const count = await prisma.category.count({ where: { userId } });

    const created = await prisma.category.create({
      data: {
        userId,
        name: data.name,
        slug,
        kind: data.kind,
        icon: data.icon,
        gradientFrom: data.gradientFrom,
        gradientTo: data.gradientTo,
        isDefault: false,
        sortOrder: count,
      },
      select: categorySelect,
    });

    await logActivity({
      userId,
      action: "created",
      entity: "category",
      entityId: created.id,
      summary: `Created category "${created.name}"`,
    });

    revalidateCategories();
    return created;
  }, "Category created");
}

export async function updateCategory(
  input: unknown,
): Promise<ActionResult<CategoryDTO>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(updateCategorySchema, input);

    const existing = await prisma.category.findFirst({
      where: { id: data.id, userId },
      select: { id: true, name: true, slug: true, isDefault: true },
    });
    if (!existing) throw new ActionError("We could not find that category.");

    // Default categories keep their slug so seeds, imports, and the natural
    // language parser keep resolving even after a rename.
    const slug = existing.isDefault
      ? existing.slug
      : await uniqueSlug(userId, data.name, data.id);

    const updated = await prisma.category.update({
      where: { id: data.id },
      data: {
        name: data.name,
        slug,
        kind: data.kind,
        icon: data.icon,
        gradientFrom: data.gradientFrom,
        gradientTo: data.gradientTo,
      },
      select: categorySelect,
    });

    await logActivity({
      userId,
      action: "updated",
      entity: "category",
      entityId: updated.id,
      summary: `Updated category "${updated.name}"`,
    });

    revalidateCategories();
    return updated;
  }, "Category updated");
}

export async function deleteCategory(id: string): Promise<ActionResult<string>> {
  return runAction(async () => {
    const userId = await requireUserId();

    const category = await prisma.category.findFirst({
      where: { id, userId },
      select: {
        id: true,
        name: true,
        _count: { select: { transactions: true, recurring: true } },
      },
    });
    if (!category) throw new ActionError("We could not find that category.");

    if (category._count.transactions > 0) {
      throw new ActionError(
        `"${category.name}" still has ${category._count.transactions} ${
          category._count.transactions === 1 ? "transaction" : "transactions"
        }. Move or delete them first.`,
      );
    }
    if (category._count.recurring > 0) {
      throw new ActionError(
        `"${category.name}" is used by a recurring rule. Update that rule first.`,
      );
    }

    await prisma.category.delete({ where: { id } });

    await logActivity({
      userId,
      action: "deleted",
      entity: "category",
      entityId: id,
      summary: `Deleted category "${category.name}"`,
    });

    revalidateCategories();
    return id;
  }, "Category deleted");
}

export async function toggleCategoryFavorite(
  id: string,
): Promise<ActionResult<CategoryDTO>> {
  return runAction(async () => {
    const userId = await requireUserId();

    const existing = await prisma.category.findFirst({
      where: { id, userId },
      select: { id: true, isFavorite: true },
    });
    if (!existing) throw new ActionError("We could not find that category.");

    const updated = await prisma.category.update({
      where: { id },
      data: { isFavorite: !existing.isFavorite },
      select: categorySelect,
    });

    revalidateCategories();
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function createTag(input: unknown): Promise<ActionResult<TagDTO>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(tagSchema, input);

    const slug = slugify(data.name);
    if (!slug) throw new ActionError("Give the tag a name using letters or numbers.");

    const existing = await prisma.tag.findFirst({
      where: { userId, slug },
      select: { id: true },
    });
    if (existing) throw new ActionError("You already have a tag with that name.");

    const created = await prisma.tag.create({
      data: { userId, name: data.name, slug, color: data.color },
      select: { id: true, name: true, slug: true, color: true },
    });

    revalidatePath("/transactions");
    revalidatePath("/settings");
    return created;
  }, "Tag created");
}

export async function deleteTag(id: string): Promise<ActionResult<string>> {
  return runAction(async () => {
    const userId = await requireUserId();

    const tag = await prisma.tag.findFirst({
      where: { id, userId },
      select: { id: true, name: true },
    });
    if (!tag) throw new ActionError("We could not find that tag.");

    // The join rows cascade, so the transactions themselves are untouched.
    await prisma.tag.delete({ where: { id } });

    revalidatePath("/transactions");
    revalidatePath("/settings");
    return id;
  }, "Tag deleted");
}
