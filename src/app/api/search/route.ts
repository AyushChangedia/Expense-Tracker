import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { searchTransactions } from "@/server/queries/transactions";

export const dynamic = "force-dynamic";

/**
 * Backs the ⌘K palette's global search: transactions, categories, tags, and
 * goals in one round trip.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().slice(0, 120);

  if (query.length < 2) {
    return NextResponse.json({
      query,
      transactions: [],
      categories: [],
      tags: [],
      goals: [],
    });
  }

  const [transactions, categories, tags, goals] = await Promise.all([
    searchTransactions(user.id, query, 8),
    prisma.category.findMany({
      where: { userId: user.id, name: { contains: query, mode: "insensitive" } },
      select: { id: true, name: true, slug: true, icon: true, gradientFrom: true, gradientTo: true },
      take: 5,
    }),
    prisma.tag.findMany({
      where: { userId: user.id, name: { contains: query, mode: "insensitive" } },
      select: { id: true, name: true, slug: true, color: true },
      take: 5,
    }),
    prisma.goal.findMany({
      where: { userId: user.id, name: { contains: query, mode: "insensitive" } },
      select: { id: true, name: true, targetAmount: true, currentAmount: true },
      take: 4,
    }),
  ]);

  return NextResponse.json({
    query,
    transactions,
    categories,
    tags,
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
    })),
  });
}
