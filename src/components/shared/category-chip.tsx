import * as React from "react";

import { getCategoryIcon } from "@/lib/categories";
import { cn } from "@/lib/utils";

type CategoryChipProps = {
  name: string;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
  className?: string;
};

const SIZES = {
  sm: { box: "size-7 rounded-lg", icon: "size-3.5" },
  default: { box: "size-10 rounded-xl", icon: "size-[18px]" },
  lg: { box: "size-12 rounded-xl", icon: "size-5" },
};

/**
 * The category glyph used everywhere a transaction is listed. The gradient is
 * per-category data, so it is applied inline rather than through a class.
 */
export function CategoryIcon({
  name,
  icon,
  gradientFrom,
  gradientTo,
  size = "default",
  className,
}: Omit<CategoryChipProps, "showLabel">) {
  const Icon = getCategoryIcon(icon);
  const dimensions = SIZES[size];

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden",
        dimensions.box,
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${gradientFrom}2E, ${gradientTo}1F)`,
        boxShadow: `inset 0 0 0 1px ${gradientFrom}33`,
      }}
      title={name}
    >
      <Icon
        className={cn("relative z-10", dimensions.icon)}
        style={{ color: gradientFrom }}
        strokeWidth={1.9}
        aria-hidden
      />
    </span>
  );
}

export function CategoryChip({
  name,
  icon,
  gradientFrom,
  gradientTo,
  showLabel = true,
  className,
}: Omit<CategoryChipProps, "size">) {
  const Icon = getCategoryIcon(icon);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        borderColor: `${gradientFrom}40`,
        background: `linear-gradient(135deg, ${gradientFrom}1F, ${gradientTo}14)`,
        color: gradientFrom,
      }}
    >
      <Icon className="size-3" strokeWidth={2.2} aria-hidden />
      {showLabel ? name : null}
    </span>
  );
}
