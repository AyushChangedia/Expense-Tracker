import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { BudgetsView } from "@/components/budgets/budgets-view";
import { PageTransition } from "@/components/shared/reveal";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import { currentMonthKey } from "@/lib/dates";
import { getBudgetProgress } from "@/server/queries/budgets";

export const metadata: Metadata = {
  title: "Budgets",
  description: "Set monthly caps and track how close you are to them.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ year?: string; month?: string }>;

export default function BudgetsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <PageTransition className="space-y-5">
      <PageHeader
        title="Budgets"
        description="Cap a category, watch the bar, and get warned before the month gets away from you."
      />

      <Suspense fallback={<BudgetsLoading />}>
        <BudgetsContent searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

async function BudgetsContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const fallback = currentMonthKey();

  // Clamp hand-edited URL values so an out-of-range month cannot break queries.
  const year = clamp(Number(params.year), 2000, 2100, fallback.year);
  const month = clamp(Number(params.month), 1, 12, fallback.month);

  const budgets = await getBudgetProgress(user.id, year, month);

  return <BudgetsView budgets={budgets} year={year} month={month} />;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value) || value < min || value > max) return fallback;
  return Math.trunc(value);
}

function BudgetsLoading() {
  return (
    <div className="space-y-5">
      <div className="glass p-6">
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </div>
  );
}
