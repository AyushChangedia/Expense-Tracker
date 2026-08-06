import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { CalendarView } from "@/components/calendar/calendar-view";
import { QuickAddButtons } from "@/components/dashboard/quick-add-buttons";
import { PageTransition } from "@/components/shared/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import { currentMonthKey, monthGrid, toUtcDay } from "@/lib/dates";
import { getTransactionsInRange } from "@/server/queries/transactions";

export const metadata: Metadata = {
  title: "Calendar",
  description: "See and add spending day by day.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ year?: string; month?: string }>;

export default function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <PageTransition className="space-y-5">
      <PageHeader
        title="Calendar"
        description="Spending laid out day by day. Darker days are heavier days."
        actions={<QuickAddButtons />}
      />

      <Suspense fallback={<CalendarLoading />}>
        <CalendarContent searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

async function CalendarContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const fallback = currentMonthKey();

  const year = clamp(Number(params.year), 2000, 2100, fallback.year);
  const month = clamp(Number(params.month), 1, 12, fallback.month);

  // The grid shows leading/trailing days from the neighbouring months, so the
  // query has to cover the whole visible range, not just the month itself.
  const grid = monthGrid(year, month, user.weekStart === 1 ? 1 : 0);
  const start = toUtcDay(grid[0]);
  const end = toUtcDay(grid[grid.length - 1]);
  end.setUTCDate(end.getUTCDate() + 1);

  const transactions = await getTransactionsInRange(user.id, start, end);

  return <CalendarView transactions={transactions} year={year} month={month} />;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value) || value < min || value > max) return fallback;
  return Math.trunc(value);
}

function CalendarLoading() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="glass p-5">
        <Skeleton className="mb-4 h-8 w-48" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }).map((_, index) => (
            <Skeleton key={index} className="h-[86px] rounded-md" />
          ))}
        </div>
      </div>
      <div className="glass h-96 p-5">
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  );
}
