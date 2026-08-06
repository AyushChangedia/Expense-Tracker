import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { GoalsView } from "@/components/goals/goals-view";
import { PageTransition } from "@/components/shared/reveal";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import { getGoals } from "@/server/queries/goals";

export const metadata: Metadata = {
  title: "Goals",
  description: "Track savings goals and the contributions that get you there.",
};

export const dynamic = "force-dynamic";

export default function GoalsPage() {
  return (
    <PageTransition className="space-y-5">
      <PageHeader
        title="Savings goals"
        description="Set a target, add contributions, and see exactly what it takes each month to land on time."
      />

      <Suspense fallback={<GoalsLoading />}>
        <GoalsContent />
      </Suspense>
    </PageTransition>
  );
}

async function GoalsContent() {
  const user = await requireUser();
  const goals = await getGoals(user.id);

  return <GoalsView goals={goals} />;
}

function GoalsLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <SkeletonCard key={index} className="h-56" />
      ))}
    </div>
  );
}
