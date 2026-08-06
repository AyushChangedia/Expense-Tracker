import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} {...props} />;
}

/** A card-shaped placeholder that matches the real card's chrome. */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass space-y-4 p-6", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn("glass space-y-5 p-6", className)}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="flex h-[220px] items-end gap-2">
        {[62, 88, 45, 96, 70, 54, 82, 38, 74, 60, 91, 48].map((height, index) => (
          <Skeleton
            key={index}
            className="flex-1 rounded-t-lg"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 border-b border-white/[0.05] px-5 py-4 last:border-0">
      <Skeleton className="size-10 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40 max-w-[60%]" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("glass overflow-hidden", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonChart, SkeletonRow, SkeletonList };
