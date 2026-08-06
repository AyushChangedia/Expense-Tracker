import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { round2 } from "@/lib/utils";
import type { RecurringDTO } from "@/types";

const recurringInclude = {
  category: {
    select: {
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
    },
  },
  _count: { select: { transactions: true } },
} as const;

type Row = Awaited<
  ReturnType<typeof prisma.recurringTransaction.findMany<{ include: typeof recurringInclude }>>
>[number];

function map(row: Row): RecurringDTO {
  return {
    id: row.id,
    type: row.type,
    amount: round2(Number(row.amount)),
    description: row.description,
    notes: row.notes,
    frequency: row.frequency,
    interval: row.interval,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate ? row.endDate.toISOString() : null,
    nextRunDate: row.nextRunDate.toISOString(),
    lastRunDate: row.lastRunDate ? row.lastRunDate.toISOString() : null,
    isActive: row.isActive,
    category: serialize(row.category),
    generatedCount: row._count.transactions,
  };
}

export async function getRecurring(userId: string): Promise<RecurringDTO[]> {
  const rows = await prisma.recurringTransaction.findMany({
    where: { userId },
    include: recurringInclude,
    orderBy: [{ isActive: "desc" }, { nextRunDate: "asc" }],
  });
  return rows.map(map);
}

/** The next few scheduled entries, shown on the dashboard. */
export async function getUpcomingRecurring(
  userId: string,
  take = 4,
): Promise<RecurringDTO[]> {
  const rows = await prisma.recurringTransaction.findMany({
    where: { userId, isActive: true },
    include: recurringInclude,
    orderBy: { nextRunDate: "asc" },
    take,
  });
  return rows.map(map);
}
