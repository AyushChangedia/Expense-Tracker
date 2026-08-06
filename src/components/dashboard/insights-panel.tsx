"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Gauge,
  PieChart,
  PiggyBank,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Insight } from "@/types";

const ICONS: Record<string, LucideIcon> = {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Gauge,
  PieChart,
  PiggyBank,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
};

const TONE = {
  positive: {
    ring: "border-success/20",
    chip: "bg-success/10 text-success border-success/20",
    glow: "rgba(34,197,94,0.35)",
  },
  neutral: {
    ring: "border-white/[0.08]",
    chip: "bg-primary/10 text-primary-200 border-primary/20",
    glow: "rgba(139,92,246,0.35)",
  },
  warning: {
    ring: "border-warning/20",
    chip: "bg-warning/10 text-warning border-warning/20",
    glow: "rgba(245,158,11,0.35)",
  },
  critical: {
    ring: "border-danger/20",
    chip: "bg-danger/10 text-danger border-danger/20",
    glow: "rgba(239,68,68,0.35)",
  },
} as const;

/**
 * Renders the output of the insights engine.
 *
 * Each card is derived arithmetically from the user's own numbers, so the
 * copy is specific rather than generic advice.
 */
export function InsightsPanel({
  insights,
  columns = 2,
}: {
  insights: Insight[];
  columns?: 1 | 2 | 3;
}) {
  if (insights.length === 0) return null;

  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 lg:grid-cols-2",
        columns === 3 && "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
      )}
    >
      {insights.map((insight, index) => {
        const Icon = ICONS[insight.icon] ?? Sparkles;
        const tone = TONE[insight.tone];

        return (
          <motion.article
            key={insight.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: index * 0.06,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={cn(
              "glass group relative overflow-hidden border p-5 transition-all duration-500 ease-smooth hover:-translate-y-0.5",
              tone.ring,
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-[0.10] blur-2xl transition-opacity duration-500 group-hover:opacity-25"
              style={{ background: `radial-gradient(circle, ${tone.glow}, transparent 70%)` }}
            />

            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl border",
                  tone.chip,
                )}
              >
                <Icon className="size-4" strokeWidth={2} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-snug text-white">
                    {insight.title}
                  </h3>
                  {insight.metric ? (
                    <span
                      className={cn(
                        "tabular shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        tone.chip,
                      )}
                    >
                      {insight.metric}
                    </span>
                  ) : null}
                </div>

                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {insight.detail}
                </p>
              </div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
