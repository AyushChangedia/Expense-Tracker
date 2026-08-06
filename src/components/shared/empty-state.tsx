"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  compact?: boolean;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        compact ? "py-10" : "py-16",
        className,
      )}
    >
      <div className="relative mb-5">
        {/* Soft bloom behind the glyph. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full bg-primary/25 blur-2xl"
        />
        <div className="relative grid size-14 place-items-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-primary/20 to-cyan/10">
          <Icon className="size-6 text-primary-200" strokeWidth={1.6} />
        </div>
      </div>

      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
        {description}
      </p>

      {action || secondaryAction ? (
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </motion.div>
  );
}
