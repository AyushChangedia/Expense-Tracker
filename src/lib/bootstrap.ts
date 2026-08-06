import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORIES } from "@/lib/categories";

/**
 * Gives an account the default category catalogue.
 *
 * Safe to call repeatedly — `skipDuplicates` plus the `[userId, slug]` unique
 * constraint means a partially seeded account is topped up rather than
 * duplicated. Called on sign-up, on first OAuth sign-in, and defensively by
 * `getUserCategories`.
 */
export async function ensureDefaultCategories(userId: string): Promise<void> {
  const existing = await prisma.category.count({ where: { userId } });
  if (existing > 0) return;

  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((category, index) => ({
      userId,
      name: category.name,
      slug: category.slug,
      kind: category.kind,
      icon: category.icon,
      gradientFrom: category.gradientFrom,
      gradientTo: category.gradientTo,
      isDefault: true,
      isFavorite: ["food", "transport", "salary", "bills"].includes(category.slug),
      sortOrder: index,
    })),
    skipDuplicates: true,
  });
}
