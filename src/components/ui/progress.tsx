"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { clamp } from "@/lib/utils";

type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
  value?: number;
  /** Gradient endpoints; defaults to the brand gradient. */
  from?: string;
  to?: string;
  tone?: "brand" | "success" | "warning" | "danger";
  size?: "sm" | "default" | "lg";
  /** Adds a travelling sheen over the filled portion. */
  animated?: boolean;
};

const TONE_GRADIENTS: Record<string, [string, string]> = {
  brand: ["#7C3AED", "#38BDF8"],
  success: ["#22C55E", "#4ADE80"],
  warning: ["#F59E0B", "#FB923C"],
  danger: ["#EF4444", "#F97316"],
};

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(
  (
    {
      className,
      value = 0,
      from,
      to,
      tone = "brand",
      size = "default",
      animated = true,
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();
    const pct = clamp(value, 0, 100);
    const [gradientFrom, gradientTo] = TONE_GRADIENTS[tone] ?? TONE_GRADIENTS.brand;

    const height = { sm: "h-1.5", default: "h-2.5", lg: "h-3.5" }[size];

    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={pct}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-white/[0.06]",
          height,
          className,
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator asChild>
          <motion.div
            className="relative h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${from ?? gradientFrom}, ${to ?? gradientTo})`,
              boxShadow: `0 0 16px -2px ${from ?? gradientFrom}80`,
            }}
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }
            }
          >
            {animated && !reduceMotion && pct > 0 ? (
              <span
                aria-hidden
                className="absolute inset-0 overflow-hidden rounded-full"
              >
                <span className="absolute inset-y-0 -left-full w-full animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              </span>
            ) : null}
          </motion.div>
        </ProgressPrimitive.Indicator>
      </ProgressPrimitive.Root>
    );
  },
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
