import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { CategoriesView } from "@/components/categories/categories-view";
import { PageTransition } from "@/components/shared/reveal";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import {
  getCategoriesWithUsage,
  getTagsWithUsage,
} from "@/server/queries/categories";

export const metadata: Metadata = {
  title: "Categories & tags",
  description: "Manage categories, icons, gradients, and tags.",
};

export const dynamic = "force-dynamic";

export default function CategoriesPage() {
  return (
    <PageTransition className="space-y-5">
      <PageHeader
        title="Categories & tags"
        description="Rename, recolour, or add your own. Built-in categories keep their identity so imports and the quick-add parser keep working."
      />

      <Suspense fallback={<CategoriesLoading />}>
        <CategoriesContent />
      </Suspense>
    </PageTransition>
  );
}

async function CategoriesContent() {
  const user = await requireUser();

  const [categories, tags] = await Promise.all([
    getCategoriesWithUsage(user.id),
    getTagsWithUsage(user.id),
  ]);

  return <CategoriesView categories={categories} tags={tags} />;
}

function CategoriesLoading() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <SkeletonCard key={index} className="h-40" />
      ))}
    </div>
  );
}
