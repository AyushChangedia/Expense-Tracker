import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { PageTransition } from "@/components/shared/reveal";
import { SkeletonChart, Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import { currentMonthKey } from "@/lib/dates";
import { getAnalyticsData } from "@/server/queries/dashboard";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Trends, category breakdowns, cash flow, and net worth.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ year?: string; month?: string; range?: string }>;

export default function AnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <PageTransition className="space-y-5">
      <PageHeader
        title="Analytics"
        description="Every chart is computed from your own transactions — no sampling, no smoothing."
      />

      <Suspense fallback={<AnalyticsLoading />}>
        <AnalyticsContent searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

async function AnalyticsContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const fallback = currentMonthKey();

  const year = clamp(Number(params.year), 2000, 2100, fallback.year);
  const month = clamp(Number(params.month), 1, 12, fallback.month);
  // Only the three windows the UI offers are accepted.
  const range = [6, 12, 24].includes(Number(params.range)) ? Number(params.range) : 12;

  const data = await getAnalyticsData(user, { year, month, range });

  return <AnalyticsView data={data} />;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value) || value < min || value > max) return fallback;
  return Math.trunc(value);
}

function AnalyticsLoading() {
  return (
    <div className="space-y-5">
      <div className="glass p-6">
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass space-y-2 p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
      <SkeletonChart />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  );
}
