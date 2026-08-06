"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Car,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";

/**
 * A static, self-contained mock of the dashboard for the marketing hero.
 *
 * Deliberately hard-coded: the landing page is public and must render without
 * a session or a database round trip. The numbers are illustrative and the
 * component is marked `aria-hidden` so screen readers skip the decoration.
 */

const BARS = [42, 68, 35, 82, 56, 74, 48, 90, 62, 78, 51, 86];

const ROWS = [
  {
    icon: UtensilsCrossed,
    label: "Dinner at Nori",
    meta: "Food · Today",
    amount: "−$48.20",
    tone: "text-danger",
    from: "#F97316",
    to: "#FB7185",
  },
  {
    icon: ShoppingBag,
    label: "Winter jacket",
    meta: "Shopping · Yesterday",
    amount: "−$129.00",
    tone: "text-danger",
    from: "#A855F7",
    to: "#EC4899",
  },
  {
    icon: Car,
    label: "Monthly transit pass",
    meta: "Transport · 2 days ago",
    amount: "−$75.00",
    tone: "text-danger",
    from: "#38BDF8",
    to: "#6366F1",
  },
];

export function HeroPreview() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden
      initial={reduceMotion ? false : { opacity: 0, y: 40, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      style={{ perspective: 1200 }}
      className="glass glow-border overflow-hidden p-4 sm:p-6"
    >
      {/* Window chrome */}
      <div className="mb-5 flex items-center gap-2 border-b border-white/[0.06] pb-4">
        <span className="size-2.5 rounded-full bg-danger/70" />
        <span className="size-2.5 rounded-full bg-warning/70" />
        <span className="size-2.5 rounded-full bg-success/70" />
        <span className="ml-3 rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-0.5 text-[10px] text-subtle">
          fluxfin.app/dashboard
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Stat tiles */}
        <div className="space-y-4 lg:col-span-1">
          {[
            {
              label: "Monthly income",
              value: "$6,420.00",
              delta: "↑ 8.2%",
              good: true,
            },
            {
              label: "Monthly expenses",
              value: "$3,187.40",
              delta: "↓ 4.1%",
              good: true,
            },
            {
              label: "Savings",
              value: "$3,232.60",
              delta: "50.4% rate",
              good: true,
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={reduceMotion ? false : { opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.5 + index * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="glass-muted p-4"
            >
              <p className="text-[10px] uppercase tracking-wider text-subtle">
                {stat.label}
              </p>
              <p className="tabular mt-1.5 text-xl font-semibold text-white">
                {stat.value}
              </p>
              <p
                className={`mt-1 flex items-center gap-1 text-[11px] ${
                  stat.good ? "text-success" : "text-danger"
                }`}
              >
                {stat.good ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                {stat.delta}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Chart + list */}
        <div className="space-y-4 lg:col-span-2">
          <div className="glass-muted p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-white">Monthly trend</p>
                <p className="text-[10px] text-subtle">Last 12 months</p>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-success" />
                  Income
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-primary" />
                  Expenses
                </span>
              </div>
            </div>

            <div className="flex h-28 items-end gap-1.5 sm:gap-2">
              {BARS.map((height, index) => (
                <motion.div
                  key={index}
                  initial={reduceMotion ? false : { height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{
                    duration: 0.8,
                    delay: 0.6 + index * 0.04,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-primary-600/80 to-cyan/70"
                />
              ))}
            </div>
          </div>

          <div className="glass-muted divide-y divide-white/[0.05] p-2">
            {ROWS.map((row, index) => (
              <motion.div
                key={row.label}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 0.9 + index * 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, ${row.from}2E, ${row.to}1A)`,
                  }}
                >
                  <row.icon
                    className="size-4"
                    style={{ color: row.from }}
                    strokeWidth={2}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-white">
                    {row.label}
                  </span>
                  <span className="block text-[10px] text-subtle">{row.meta}</span>
                </span>
                <span className={`tabular text-xs font-semibold ${row.tone}`}>
                  {row.amount}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
