import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORIES } from "@/lib/categories";

/**
 * Gives a brand-new account the default category catalogue.
 *
 * Safe to call repeatedly, and cheap: the count returns early on every call
 * after the first, which is what makes the defensive call in
 * `getUserCategories` affordable. It runs on sign-up, on first OAuth sign-in,
 * and from there.
 *
 * It seeds an *empty* account and does not top up a partly-populated one. That
 * is deliberate rather than an oversight: a user who deletes a default
 * category means it, and topping up would resurrect it on the next page load.
 * The consequence is that an account created before a new default was added to
 * DEFAULT_CATEGORIES never receives it — adding one is a migration, not an
 * edit to this list.
 *
 * (`skipDuplicates` and the `[userId, slug]` unique constraint are belt and
 * braces for a concurrent first sign-in, where two requests can both pass the
 * count before either has inserted.)
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
