import { Skeleton } from "@/components/ui/skeleton";

/** Matches the AuthCard chrome so the swap to the real form is not jarring. */
export function AuthFormSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="glass overflow-hidden">
      <div className="space-y-2.5 p-7 pb-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      <div className="space-y-4 px-7 pb-7">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="mx-auto h-3 w-32" />

        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}

        <Skeleton className="h-10 w-full rounded-xl" />
      </div>

      <div className="border-t border-white/[0.06] px-7 py-5">
        <Skeleton className="mx-auto h-4 w-44" />
      </div>
    </div>
  );
}
