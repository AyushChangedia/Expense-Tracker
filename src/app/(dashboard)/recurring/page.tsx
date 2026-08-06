import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { RecurringView } from "@/components/recurring/recurring-view";
import { PageTransition } from "@/components/shared/reveal";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import { runDueRecurring } from "@/lib/recurring";
import { getRecurring } from "@/server/queries/recurring";

export const metadata: Metadata = {
  title: "Recurring",
  description: "Rules that post transactions on a schedule.",
};

export const dynamic = "force-dynamic";

export default function RecurringPage() {
  return (
    <PageTransition className="space-y-5">
      <PageHeader
        title="Recurring transactions"
        description="Rent, salary, and subscriptions post themselves. A rule that starts in the past fills in its backlog straight away."
      />

      <Suspense fallback={<RecurringLoading />}>
        <RecurringContent />
      </Suspense>
    </PageTransition>
  );
}

async function RecurringContent() {
  const user = await requireUser();

  // Post anything due before listing, so "next run" dates are accurate.
  await runDueRecurring(user.id);
  const rules = await getRecurring(user.id);

  return <RecurringView rules={rules} />;
}

function RecurringLoading() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <SkeletonCard key={index} className="h-44" />
      ))}
    </div>
  );
}
