import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { toUtcDay } from "@/lib/dates";
import { serialize } from "@/lib/serialize";
import type { TransactionFilters } from "@/lib/validations";
import type { TransactionDTO, TransactionPage } from "@/types";

export const transactionInclude = {
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
  tags: {
    select: {
      tag: { select: { id: true, name: true, slug: true, color: true } },
    },
  },
} satisfies Prisma.TransactionInclude;

type TransactionRow = Prisma.TransactionGetPayload<{
  include: typeof transactionInclude;
}>;

export function mapTransaction(row: TransactionRow): TransactionDTO {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    description: row.description,
    notes: row.notes,
    date: row.date.toISOString(),
    isPinned: row.isPinned,
    recurringId: row.recurringId,
    createdAt: row.createdAt.toISOString(),
    category: serialize(row.category),
    tags: row.tags.map((link) => link.tag),
  };
}

/** Translates the UI filter object into a Prisma `where` clause. */
export function buildTransactionWhere(
  userId: string,
  filters: Partial<TransactionFilters>,
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };
  const and: Prisma.TransactionWhereInput[] = [];

  if (filters.query) {
    const query = filters.query.trim();
    if (query) {
      and.push({
        OR: [
          { description: { contains: query, mode: "insensitive" } },
          { notes: { contains: query, mode: "insensitive" } },
          { category: { name: { contains: query, mode: "insensitive" } } },
          { tags: { some: { tag: { name: { contains: query, mode: "insensitive" } } } } },
        ],
      });
    }
  }

  if (filters.type && filters.type !== "ALL") {
    where.type = filters.type;
  }

  if (filters.categoryIds && filters.categoryIds.length > 0) {
    where.categoryId = { in: filters.categoryIds };
  }

  if (filters.tags && filters.tags.length > 0) {
    and.push({ tags: { some: { tag: { slug: { in: filters.tags } } } } });
  }

  if (filters.from || filters.to) {
    where.date = {};
    if (filters.from) where.date.gte = toUtcDay(filters.from);
    // `to` is inclusive for the user, so query up to the start of the next day.
    if (filters.to) {
      const end = toUtcDay(filters.to);
      end.setUTCDate(end.getUTCDate() + 1);
      where.date.lt = end;
    }
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.amount = {};
    if (filters.minAmount !== undefined) where.amount.gte = filters.minAmount;
    if (filters.maxAmount !== undefined) where.amount.lte = filters.maxAmount;
  }

  if (filters.pinnedOnly) {
    where.isPinned = true;
  }

  if (and.length > 0) where.AND = and;
  return where;
}

function buildOrderBy(
  filters: Partial<TransactionFilters>,
): Prisma.TransactionOrderByWithRelationInput[] {
  const direction = filters.direction ?? "desc";
  switch (filters.sort) {
    case "amount":
      return [{ amount: direction }, { date: "desc" }];
    case "description":
      return [{ description: direction }, { date: "desc" }];
    case "category":
      return [{ category: { name: direction } }, { date: "desc" }];
    case "createdAt":
      return [{ createdAt: direction }];
    case "date":
    default:
      return [{ date: direction }, { createdAt: direction }];
  }
}

export async function getTransactionPage(
  userId: string,
  filters: TransactionFilters,
): Promise<TransactionPage> {
  const where = buildTransactionWhere(userId, filters);
  const page = Math.max(1, filters.page);
  const pageSize = filters.pageSize;

  const [total, rows, incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: transactionInclude,
      orderBy: buildOrderBy(filters),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    // Totals reflect the whole filtered set, not just the visible page.
    prisma.transaction.aggregate({
      where: { ...where, type: "INCOME" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: "EXPENSE" },
      _sum: { amount: true },
    }),
  ]);

  const income = incomeAgg._sum.amount ? Number(incomeAgg._sum.amount) : 0;
  const expense = expenseAgg._sum.amount ? Number(expenseAgg._sum.amount) : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return {
    items: rows.map(mapTransaction),
    total,
    page: Math.min(page, pageCount),
    pageSize,
    pageCount,
    totals: { income, expense, net: income - expense },
  };
}

export async function getTransactionById(
  userId: string,
  id: string,
): Promise<TransactionDTO | null> {
  const row = await prisma.transaction.findFirst({
    where: { id, userId },
    include: transactionInclude,
  });
  return row ? mapTransaction(row) : null;
}

export async function getRecentTransactions(
  userId: string,
  take = 8,
): Promise<TransactionDTO[]> {
  const rows = await prisma.transaction.findMany({
    where: { userId },
    include: transactionInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
  });
  return rows.map(mapTransaction);
}

export async function getPinnedTransactions(
  userId: string,
  take = 5,
): Promise<TransactionDTO[]> {
  const rows = await prisma.transaction.findMany({
    where: { userId, isPinned: true },
    include: transactionInclude,
    orderBy: [{ date: "desc" }],
    take,
  });
  return rows.map(mapTransaction);
}

/** Every transaction in a date window — used by the calendar and exports. */
export async function getTransactionsInRange(
  userId: string,
  start: Date,
  end: Date,
): Promise<TransactionDTO[]> {
  const rows = await prisma.transaction.findMany({
    where: { userId, date: { gte: start, lt: end } },
    include: transactionInclude,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(mapTransaction);
}

/** Instant results for the global search palette. */
export async function searchTransactions(
  userId: string,
  query: string,
  take = 8,
): Promise<TransactionDTO[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const rows = await prisma.transaction.findMany({
    where: buildTransactionWhere(userId, { query: trimmed }),
    include: transactionInclude,
    orderBy: [{ date: "desc" }],
    take,
  });
  return rows.map(mapTransaction);
}

export async function getAllTransactionsForExport(userId: string) {
  return prisma.transaction.findMany({
    where: { userId },
    include: transactionInclude,
    orderBy: [{ date: "desc" }],
  });
}
