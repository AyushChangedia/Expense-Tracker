import { cn } from "@/lib/utils";

/**
 * The ambient background: two drifting gradient blobs, a faint grid, and a
 * vignette. Purely decorative and pointer-transparent, so it never intercepts
 * clicks or shows up in the accessibility tree.
 *
 * Rendered as a server component — there is no state, only CSS animation.
 */
export function GradientBlobs({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "subtle" | "hero";
}) {
  const intensity = {
    default: { primary: "opacity-[0.22]", cyan: "opacity-[0.16]" },
    subtle: { primary: "opacity-[0.12]", cyan: "opacity-[0.09]" },
    hero: { primary: "opacity-[0.34]", cyan: "opacity-[0.26]" },
  }[variant];

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0 bg-canvas" />

      {/* Faint grid, faded out towards the edges. */}
      <div
        className="absolute inset-0 bg-grid"
        style={{
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 78%)",
        }}
      />

      <div
        className={cn(
          "absolute -left-[10%] -top-[18%] size-[46rem] rounded-full blur-[130px] animate-float",
          intensity.primary,
        )}
        style={{
          background:
            "radial-gradient(circle at 30% 30%, #7C3AED 0%, #A855F7 45%, transparent 70%)",
        }}
      />

      <div
        className={cn(
          "absolute -right-[12%] top-[22%] size-[40rem] rounded-full blur-[130px] animate-float-slow",
          intensity.cyan,
        )}
        style={{
          background:
            "radial-gradient(circle at 60% 40%, #38BDF8 0%, #22D3EE 40%, transparent 70%)",
        }}
      />

      <div
        className={cn(
          "absolute bottom-[-20%] left-[28%] size-[38rem] rounded-full blur-[140px] animate-float",
          variant === "hero" ? "opacity-[0.20]" : "opacity-[0.10]",
        )}
        style={{
          animationDelay: "-6s",
          background:
            "radial-gradient(circle at 50% 50%, #A855F7 0%, #6366F1 45%, transparent 70%)",
        }}
      />

      {/* Vignette keeps the corners from feeling washed out. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(8,8,11,0.85)_100%)]" />
    </div>
  );
}
