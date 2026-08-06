"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Scale } from "lucide-react";

import { AnimatedCounter } from "@/components/shared/animated-counter";
import { usePreferences } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";

/**
 * Totals for the *filtered* set, not just the visible page — so narrowing to
 * "Food, last 90 days" immediately answers "how much was that?".
 */
export function TransactionTotals({
  totals,
  count,
}: {
  totals: { income: number; expense: number; net: number };
  count: number;
}) {
  const { currency, locale } = usePreferences();

  const cards = [
    {
      label: "Income",
      value: totals.income,
      icon: ArrowUpRight,
      color: "#22C55E",
      className: "text-success",
    },
    {
      label: "Expenses",
      value: totals.expense,
      icon: ArrowDownRight,
      color: "#EF4444",
      className: "text-danger",
    },
    {
      label: "Net",
      value: totals.net,
      icon: Scale,
      color: "#8B5CF6",
      className: totals.net < 0 ? "text-danger" : "text-white",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="glass flex items-center gap-3 p-4"
        >
          <span
            className="grid size-9 shrink-0 place-items-center rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${card.color}26, ${card.color}0F)`,
              boxShadow: `inset 0 0 0 1px ${card.color}2E`,
            }}
          >
            <card.icon
              className="size-4"
              style={{ color: card.color }}
              strokeWidth={2}
            />
          </span>

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-subtle">
              {card.label}
              {card.label === "Net" ? (
                <span className="ml-1.5 normal-case tracking-normal">
                  · {count} {count === 1 ? "entry" : "entries"}
                </span>
              ) : null}
            </p>
            <p className={cn("tabular text-lg font-semibold", card.className)}>
              <AnimatedCounter
                value={card.value}
                currency={currency}
                locale={locale}
                duration={0.8}
              />
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
