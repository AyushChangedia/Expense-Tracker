import {
  Skeleton,
  SkeletonCard,
  SkeletonChart,
  SkeletonList,
} from "@/components/ui/skeleton";

/** Mirrors the dashboard grid so the swap to real content does not reflow. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      <div className="glass p-4 sm:p-5">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SkeletonChart className="xl:col-span-2" />
        <div className="space-y-4">
          <div className="glass space-y-4 p-6">
            <Skeleton className="h-4 w-36" />
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-7 rounded-lg" />
                  <Skeleton className="h-3.5 flex-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SkeletonList rows={6} className="xl:col-span-2" />
        <SkeletonList rows={4} />
      </div>
    </div>
  );
}
