"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarClock, Pin, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Amount } from "@/components/shared/amount";
import { CategoryIcon } from "@/components/shared/category-chip";
import { SectionHeading } from "@/components/shared/page-header";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import { formatDate, frequencyLabel, relativeDay } from "@/lib/dates";
import { getCategoryIcon } from "@/lib/categories";
import type { GoalDTO, RecurringDTO, TransactionDTO } from "@/types";

/** Transactions the user pinned — kept in reach on the dashboard. */
export function PinnedTransactions({ transactions }: { transactions: TransactionDTO[] }) {
  const { dateFormat } = usePreferences();
  const { openEdit } = useTransactionDialog();

  if (transactions.length === 0) return null;

  return (
    <div className="glass glow-border overflow-hidden">
      <div className="p-5 pb-3 sm:p-6 sm:pb-3">
        <SectionHeading
          title="Pinned"
          description="Transactions you asked to keep an eye on"
        />
      </div>

      <ul className="divide-y divide-white/[0.05]">
        {transactions.map((transaction, index) => (
          <motion.li
            key={transaction.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              onClick={() => openEdit(transaction)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-white/[0.03] sm:px-6"
            >
              <CategoryIcon
                name={transaction.category.name}
                icon={transaction.category.icon}
                gradientFrom={transaction.category.gradientFrom}
                gradientTo={transaction.category.gradientTo}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-white">
                  {transaction.description}
                </span>
                <span className="block text-[11px] text-subtle">
                  {relativeDay(transaction.date, dateFormat)}
                </span>
              </span>
              <Pin className="size-3 shrink-0 text-primary-300" />
              <Amount
                value={transaction.amount}
                type={transaction.type}
                className="shrink-0 text-sm"
              />
            </button>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/** The next few scheduled rules, so nothing lands unexpectedly. */
export function UpcomingRecurring({ rules }: { rules: RecurringDTO[] }) {
  const { dateFormat } = usePreferences();

  if (rules.length === 0) return null;

  return (
    <div className="glass glow-border overflow-hidden">
      <div className="p-5 pb-3 sm:p-6 sm:pb-3">
        <SectionHeading
          title="Coming up"
          description="Recurring entries due next"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/recurring">
                All rules
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        />
      </div>

      <ul className="divide-y divide-white/[0.05]">
        {rules.map((rule, index) => (
          <motion.li
            key={rule.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 px-5 py-3 sm:px-6"
          >
            <CategoryIcon
              name={rule.category.name}
              icon={rule.category.icon}
              gradientFrom={rule.category.gradientFrom}
              gradientTo={rule.category.gradientTo}
              size="sm"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white">{rule.description}</p>
              <p className="flex items-center gap-1 truncate text-[11px] text-subtle">
                <CalendarClock className="size-3" />
                {formatDate(rule.nextRunDate, dateFormat)} ·{" "}
                {frequencyLabel(rule.frequency, rule.interval)}
              </p>
            </div>

            <Amount value={rule.amount} type={rule.type} className="shrink-0 text-sm" />
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/** Active savings goals with progress and what it takes to finish on time. */
export function GoalsPreview({ goals }: { goals: GoalDTO[] }) {
  const { formatMoney } = usePreferences();
  const active = goals.filter((goal) => goal.status === "ACTIVE").slice(0, 3);

  if (active.length === 0) return null;

  return (
    <div className="glass glow-border overflow-hidden">
      <div className="p-5 pb-4 sm:p-6 sm:pb-4">
        <SectionHeading
          title="Savings goals"
          description="How close you are to each target"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/goals">
                Manage
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        />
      </div>

      <div className="space-y-4 px-5 pb-6 sm:px-6">
        {active.map((goal, index) => {
          const Icon = getCategoryIcon(goal.icon) ?? Target;

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, ${goal.gradientFrom}2E, ${goal.gradientTo}1A)`,
                  }}
                >
                  <Icon
                    className="size-3.5"
                    style={{ color: goal.gradientFrom }}
                    strokeWidth={2}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{goal.name}</p>
                  <p className="text-[11px] text-subtle">
                    {goal.pacing === "overdue"
                      ? `${formatMoney(goal.requiredPerMonth ?? 0)} still to save — deadline passed`
                      : goal.requiredPerMonth !== null
                      ? `${formatMoney(goal.requiredPerMonth)}/month to finish on time`
                      : `${formatMoney(goal.remaining)} to go`}
                  </p>
                </div>

                <p className="tabular shrink-0 text-xs font-semibold text-white">
                  {Math.round(goal.percentComplete)}%
                </p>
              </div>

              <Progress
                value={goal.percentComplete}
                from={goal.gradientFrom}
                to={goal.gradientTo}
                size="sm"
                aria-label={`${goal.name}: ${Math.round(goal.percentComplete)}% funded`}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
