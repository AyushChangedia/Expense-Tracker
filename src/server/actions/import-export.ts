"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { toUtcDay } from "@/lib/dates";
import { toDecimal } from "@/lib/serialize";
import { requireUserId } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { matchCategorySlug, type ParsedImportRow } from "@/lib/import-export";
import { logActivity, notify } from "@/server/queries/activity";
import { ActionError, runAction } from "@/server/actions/helpers";
import type { ActionResult } from "@/types";

const MAX_IMPORT_ROWS = 5_000;

export type ImportSummary = {
  imported: number;
  skipped: number;
  categoriesCreated: string[];
  tagsCreated: number;
};

/**
 * Commits rows produced by `/api/import/preview`.
 *
 * Unknown categories become real categories rather than being dropped, which
 * is what makes a bank export usable without pre-cleaning the file. Rows are
 * re-validated here — the preview is a convenience, not a trust boundary.
 */
export async function commitImport(
  rows: ParsedImportRow[],
  options: { createMissingCategories?: boolean } = {},
): Promise<ActionResult<ImportSummary>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const createMissing = options.createMissingCategories ?? true;

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new ActionError("There is nothing to import.");
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new ActionError(
        `That file has ${rows.length} rows. Import up to ${MAX_IMPORT_ROWS} at a time.`,
      );
    }

    const categories = await prisma.category.findMany({
      where: { userId },
      select: { id: true, slug: true, name: true, kind: true },
    });

    const fallback =
      categories.find((category) => category.slug === "other") ?? categories[0];
    if (!fallback) {
      throw new ActionError("Add at least one category before importing.");
    }

    const bySlug = new Map(categories.map((category) => [category.slug, category]));
    const categoriesCreated: string[] = [];

    // --- Create any categories the file references but the account lacks ---
    if (createMissing) {
      const missing = new Map<string, { name: string; kind: "INCOME" | "EXPENSE" }>();

      for (const row of rows) {
        if (!row.category) continue;
        if (matchCategorySlug(row.category, categories)) continue;

        const slug = slugify(row.category);
        if (!slug || missing.has(slug) || bySlug.has(slug)) continue;

        missing.set(slug, {
          name: row.category.slice(0, 40),
          kind: row.type,
        });
      }

      if (missing.size > 0) {
        const offset = categories.length;
        await prisma.category.createMany({
          data: Array.from(missing.entries()).map(([slug, meta], index) => ({
            userId,
            slug,
            name: meta.name,
            kind: meta.kind,
            icon: "Shapes",
            gradientFrom: "#7C3AED",
            gradientTo: "#38BDF8",
            isDefault: false,
            sortOrder: offset + index,
          })),
          skipDuplicates: true,
        });

        const created = await prisma.category.findMany({
          where: { userId, slug: { in: Array.from(missing.keys()) } },
          select: { id: true, slug: true, name: true, kind: true },
        });

        for (const category of created) {
          bySlug.set(category.slug, category);
          categories.push(category);
          categoriesCreated.push(category.name);
        }
      }
    }

    // --- Create any tags the file references -----------------------------
    const tagNames = new Map<string, string>();
    for (const row of rows) {
      for (const tag of row.tags) {
        const slug = slugify(tag);
        if (slug) tagNames.set(slug, tag.slice(0, 30));
      }
    }

    let tagsCreated = 0;
    const tagIdBySlug = new Map<string, string>();

    if (tagNames.size > 0) {
      const result = await prisma.tag.createMany({
        data: Array.from(tagNames.entries()).map(([slug, name]) => ({
          userId,
          slug,
          name,
        })),
        skipDuplicates: true,
      });
      tagsCreated = result.count;

      const tags = await prisma.tag.findMany({
        where: { userId, slug: { in: Array.from(tagNames.keys()) } },
        select: { id: true, slug: true },
      });
      for (const tag of tags) tagIdBySlug.set(tag.slug, tag.id);
    }

    // --- Build the insert payload ----------------------------------------
    const payload: {
      id: string;
      data: {
        userId: string;
        categoryId: string;
        type: "INCOME" | "EXPENSE";
        amount: ReturnType<typeof toDecimal>;
        description: string;
        notes: string | null;
        date: Date;
      };
      tagIds: string[];
    }[] = [];

    let skipped = 0;

    for (const row of rows) {
      const amount = Number(row.amount);
      const date = new Date(row.date);

      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        Number.isNaN(date.getTime()) ||
        !row.description?.trim()
      ) {
        skipped += 1;
        continue;
      }

      const matchedSlug = matchCategorySlug(row.category, categories);
      const category = matchedSlug ? bySlug.get(matchedSlug) : undefined;

      payload.push({
        id: crypto.randomUUID(),
        data: {
          userId,
          categoryId: category?.id ?? fallback.id,
          type: row.type === "INCOME" ? "INCOME" : "EXPENSE",
          amount: toDecimal(Math.min(amount, 999_999_999.99)),
          description: row.description.trim().slice(0, 140),
          notes: row.notes?.trim() ? row.notes.trim().slice(0, 500) : null,
          date: toUtcDay(date),
        },
        tagIds: row.tags
          .map((tag) => tagIdBySlug.get(slugify(tag)))
          .filter((id): id is string => Boolean(id)),
      });
    }

    if (payload.length === 0) {
      throw new ActionError("None of those rows could be imported.");
    }

    await prisma.$transaction([
      prisma.transaction.createMany({
        data: payload.map((entry) => ({ id: entry.id, ...entry.data })),
      }),
      prisma.transactionTag.createMany({
        data: payload.flatMap((entry) =>
          entry.tagIds.map((tagId) => ({ transactionId: entry.id, tagId })),
        ),
        skipDuplicates: true,
      }),
    ]);

    await logActivity({
      userId,
      action: "imported",
      entity: "transaction",
      summary: `Imported ${payload.length} ${payload.length === 1 ? "transaction" : "transactions"}`,
    });

    await notify({
      userId,
      title: "Import complete",
      message: `${payload.length} ${payload.length === 1 ? "transaction was" : "transactions were"} added${
        skipped > 0 ? `, ${skipped} skipped` : ""
      }.`,
      type: "SUCCESS",
      href: "/transactions",
    });

    revalidatePath("/", "layout");

    return {
      imported: payload.length,
      skipped,
      categoriesCreated,
      tagsCreated,
    } satisfies ImportSummary;
  }, "Import complete");
}
