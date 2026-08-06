"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, PiggyBank } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CategoryIcon } from "@/components/shared/category-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/page-header";
import { usePreferences } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";
import type { BudgetProgress } from "@/types";

const STATUS_TONE = {
  healthy: { tone: "brand" as const, label: "On track", className: "text-primary-200" },
  warning: { tone: "warning" as const, label: "Close to limit", className: "text-warning" },
  exceeded: { tone: "danger" as const, label: "Over budget", className: "text-danger" },
};

export function BudgetOverview({
  budgets,
  limit = 4,
}: {
  budgets: BudgetProgress[];
  limit?: number;
}) {
  const { formatMoney } = usePreferences();

  // Show the budgets under most pressure first — that is what needs attention.
  const sorted = React.useMemo(
    () => [...budgets].sort((a, b) => b.percentUsed - a.percentUsed).slice(0, limit),
    [budgets, limit],
  );

  return (
    <div className="glass glow-border flex h-full flex-col overflow-hidden">
      <div className="p-5 pb-4 sm:p-6 sm:pb-4">
        <SectionHeading
          title="Budgets this month"
          description="Progress against the caps you set"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/budgets">
                Manage
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No budgets set"
          description="Cap the categories that tend to run away and get warned before they do."
          compact
          action={
            <Button asChild size="sm">
              <Link href="/budgets">Create a budget</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex-1 space-y-4 px-5 pb-6 sm:px-6">
          {sorted.map((budget, index) => {
            const status = STATUS_TONE[budget.status];
            const name = budget.category?.name ?? "Overall";

            return (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.07,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2.5">
                  {budget.category ? (
                    <CategoryIcon
                      name={budget.category.name}
                      icon={budget.category.icon}
                      gradientFrom={budget.category.gradientFrom}
                      gradientTo={budget.category.gradientTo}
                      size="sm"
                    />
                  ) : (
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15">
                      <PiggyBank className="size-3.5 text-primary-300" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{name}</p>
                    <p className={cn("text-[11px]", status.className)}>
                      {status.label}
                      {budget.status !== "exceeded" && budget.dailyAllowance > 0
                        ? ` · ${formatMoney(budget.dailyAllowance)}/day left`
                        : budget.status === "exceeded"
                          ? ` by ${formatMoney(Math.abs(budget.remaining))}`
                          : ""}
                    </p>
                  </div>

                  <p className="tabular shrink-0 text-right text-xs">
                    <span className="font-semibold text-white">
                      {formatMoney(budget.spent, { compact: true })}
                    </span>
                    <span className="text-subtle">
                      {" / "}
                      {formatMoney(budget.amount, { compact: true })}
                    </span>
                  </p>
                </div>

                <Progress
                  value={Math.min(budget.percentUsed, 100)}
                  tone={status.tone}
                  size="sm"
                  aria-label={`${name}: ${Math.round(budget.percentUsed)}% of budget used`}
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
