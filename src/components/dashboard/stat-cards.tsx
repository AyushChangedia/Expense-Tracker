"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Landmark,
  PiggyBank,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { AnimatedCounter } from "@/components/shared/animated-counter";
import { DeltaBadge } from "@/components/shared/amount";
import { Progress } from "@/components/ui/progress";
import { usePreferences } from "@/components/providers/preferences-provider";
import { cn, clamp } from "@/lib/utils";
import type { StatSummary } from "@/types";

type StatDefinition = {
  key: string;
  label: string;
  value: number;
  change: number | null;
  /** For expenses, a rise is bad — flips the delta colouring. */
  invertDelta?: boolean;
  icon: LucideIcon;
  gradient: [string, string];
  caption: string;
  /** Renders a progress bar under the value (savings rate). */
  meter?: number;
};

export function StatCards({ summary }: { summary: StatSummary }) {
  const { currency, locale } = usePreferences();

  const stats: StatDefinition[] = [
    {
      key: "income",
      label: "Monthly income",
      value: summary.income,
      change: summary.incomeChange,
      icon: ArrowUpRight,
      gradient: ["#22C55E", "#4ADE80"],
      caption: "vs last month",
    },
    {
      key: "expenses",
      label: "Monthly expenses",
      value: summary.expenses,
      change: summary.expenseChange,
      invertDelta: true,
      icon: ArrowDownRight,
      gradient: ["#EF4444", "#F97316"],
      caption: "vs last month",
    },
    {
      key: "savings",
      label: "Savings",
      value: summary.savings,
      change: summary.savingsChange,
      icon: PiggyBank,
      gradient: ["#8B5CF6", "#A855F7"],
      caption: `${Math.round(summary.savingsRate)}% of income kept`,
      meter: clamp(summary.savingsRate, 0, 100),
    },
    {
      key: "balance",
      label: "Current balance",
      value: summary.balance,
      change: null,
      icon: Landmark,
      gradient: ["#38BDF8", "#22D3EE"],
      caption: "All time, income minus expenses",
    },
    {
      key: "cashflow",
      label: "Net cash flow",
      value: summary.netCashFlow,
      change: summary.netCashFlowChange,
      icon: TrendingUp,
      gradient: ["#A855F7", "#38BDF8"],
      caption: "Rolling 30 days",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {stats.map((stat, index) => (
        <motion.article
          key={stat.key}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: index * 0.06,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="glass glow-border group relative overflow-hidden p-5 transition-all duration-500 ease-smooth hover:-translate-y-1 hover:shadow-lift"
        >
          {/* Colour wash that intensifies on hover. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full opacity-[0.14] blur-2xl transition-opacity duration-500 group-hover:opacity-30"
            style={{
              background: `radial-gradient(circle, ${stat.gradient[0]}, transparent 70%)`,
            }}
          />

          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-subtle">
              {stat.label}
            </p>
            <span
              className="grid size-8 shrink-0 place-items-center rounded-lg transition-transform duration-500 group-hover:scale-110"
              style={{
                background: `linear-gradient(135deg, ${stat.gradient[0]}26, ${stat.gradient[1]}14)`,
                boxShadow: `inset 0 0 0 1px ${stat.gradient[0]}2E`,
              }}
            >
              <stat.icon
                className="size-4"
                style={{ color: stat.gradient[0] }}
                strokeWidth={2}
              />
            </span>
          </div>

          <p
            className={cn(
              "tabular mt-3 text-2xl font-semibold tracking-tight",
              stat.value < 0 ? "text-danger" : "text-white",
            )}
          >
            <AnimatedCounter
              value={stat.value}
              currency={currency}
              locale={locale}
              compact
            />
          </p>

          {stat.meter !== undefined ? (
            <div className="mt-3">
              <Progress
                value={stat.meter}
                from={stat.gradient[0]}
                to={stat.gradient[1]}
                size="sm"
                aria-label={`Savings rate ${Math.round(stat.meter)}%`}
              />
            </div>
          ) : null}

          <div className="mt-2.5 flex items-center gap-2">
            {stat.change !== null ? (
              <DeltaBadge value={stat.change} invert={stat.invertDelta} />
            ) : null}
            <span className="truncate text-[11px] text-subtle">{stat.caption}</span>
          </div>
        </motion.article>
      ))}
    </div>
  );
}
