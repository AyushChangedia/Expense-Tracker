import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { ensureDefaultCategories } from "@/lib/bootstrap";
import type { CategoryDTO, TagDTO } from "@/types";

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

export const getCategories = cache(async (userId: string): Promise<CategoryDTO[]> => {
  let rows = await prisma.category.findMany({
    where: { userId },
    select: categorySelect,
    orderBy: [{ isFavorite: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  // An account can only reach here with zero categories if seeding was missed
  // (e.g. an OAuth user created before this ran) — top it up rather than
  // rendering an unusable form.
  if (rows.length === 0) {
    await ensureDefaultCategories(userId);
    rows = await prisma.category.findMany({
      where: { userId },
      select: categorySelect,
      orderBy: [{ isFavorite: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
  }

  return rows;
});

export const getTags = cache(async (userId: string): Promise<TagDTO[]> => {
  return prisma.tag.findMany({
    where: { userId },
    select: { id: true, name: true, slug: true, color: true },
    orderBy: { name: "asc" },
  });
});

/** Category list plus how heavily each one is used — powers the manage screen. */
export async function getCategoriesWithUsage(userId: string) {
  const [categories, grouped] = await Promise.all([
    getCategories(userId),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  const usage = new Map(
    grouped.map((row) => [
      row.categoryId,
      {
        count: row._count._all,
        total: row._sum.amount ? Number(row._sum.amount) : 0,
      },
    ]),
  );

  return categories.map((category) => ({
    ...category,
    transactionCount: usage.get(category.id)?.count ?? 0,
    totalAmount: usage.get(category.id)?.total ?? 0,
  }));
}

export async function getTagsWithUsage(userId: string) {
  const tags = await prisma.tag.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      _count: { select: { transactions: true } },
    },
    orderBy: { name: "asc" },
  });

  return tags.map(({ _count, ...tag }) => ({
    ...tag,
    transactionCount: _count.transactions,
  }));
}
