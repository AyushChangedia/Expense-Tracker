"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CategoryIcon } from "@/components/shared/category-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { BudgetDialog } from "@/components/budgets/budget-dialog";
import { usePreferences } from "@/components/providers/preferences-provider";
import { monthLabel, shiftMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { copyBudgetsToMonth, deleteBudget } from "@/server/actions/budgets";
import type { BudgetProgress } from "@/types";

const STATUS = {
  healthy: {
    tone: "brand" as const,
    label: "On track",
    badge: "default" as const,
    text: "text-primary-200",
  },
  warning: {
    tone: "warning" as const,
    label: "Nearing limit",
    badge: "warning" as const,
    text: "text-warning",
  },
  exceeded: {
    tone: "danger" as const,
    label: "Over budget",
    badge: "danger" as const,
    text: "text-danger",
  },
};

export function BudgetsView({
  budgets,
  year,
  month,
}: {
  budgets: BudgetProgress[];
  year: number;
  month: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { formatMoney } = usePreferences();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BudgetProgress | null>(null);
  const [deleting, setDeleting] = React.useState<BudgetProgress | null>(null);
  const [pending, setPending] = React.useState(false);

  function goToMonth(delta: number) {
    const next = shiftMonth(year, month, delta);
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(next.year));
    params.set("month", String(next.month));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const totals = React.useMemo(() => {
    // An overall budget supersedes the per-category sum; counting both would
    // double the same money.
    const overall = budgets.find((budget) => budget.categoryId === null);
    const categoryBudgets = budgets.filter((budget) => budget.categoryId !== null);

    const budgeted = overall
      ? overall.amount
      : categoryBudgets.reduce((acc, budget) => acc + budget.amount, 0);
    const spent = overall
      ? overall.spent
      : categoryBudgets.reduce((acc, budget) => acc + budget.spent, 0);

    return {
      budgeted,
      spent,
      remaining: budgeted - spent,
      percent: budgeted > 0 ? (spent / budgeted) * 100 : 0,
      exceeded: budgets.filter((budget) => budget.status === "exceeded").length,
      warning: budgets.filter((budget) => budget.status === "warning").length,
    };
  }, [budgets]);

  async function handleDelete() {
    if (!deleting) return;
    setPending(true);

    const result = await deleteBudget(deleting.id);
    setPending(false);
    setDeleting(null);

    if (result.ok) {
      toast.success("Budget removed");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleCopyFromLastMonth() {
    const previous = shiftMonth(year, month, -1);
    const result = await copyBudgetsToMonth({
      fromMonth: previous.month,
      fromYear: previous.year,
      toMonth: month,
      toYear: year,
    });

    if (result.ok) {
      toast.success(
        `Copied ${result.data} ${result.data === 1 ? "budget" : "budgets"} from ${monthLabel(previous.year, previous.month)}`,
      );
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-5">
      {/* Month switcher + summary */}
      <div className="glass glow-border p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => goToMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>

            <div className="min-w-[150px] text-center">
              <p className="text-sm font-semibold text-white">
                {monthLabel(year, month)}
              </p>
              <p className="text-[11px] text-subtle">
                {budgets.length} {budgets.length === 1 ? "budget" : "budgets"}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => goToMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {budgets.length > 0 ? (
            <div className="flex flex-1 flex-col gap-3 lg:max-w-lg">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-subtle">
                    Spent of budgeted
                  </p>
                  <p className="tabular text-xl font-semibold text-white">
                    <AnimatedCounter value={totals.spent} duration={0.9} />
                    <span className="text-sm font-normal text-subtle">
                      {" / "}
                      {formatMoney(totals.budgeted)}
                    </span>
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider text-subtle">
                    {totals.remaining >= 0 ? "Remaining" : "Over by"}
                  </p>
                  <p
                    className={cn(
                      "tabular text-lg font-semibold",
                      totals.remaining >= 0 ? "text-success" : "text-danger",
                    )}
                  >
                    {formatMoney(Math.abs(totals.remaining))}
                  </p>
                </div>
              </div>

              <Progress
                value={Math.min(totals.percent, 100)}
                tone={
                  totals.percent >= 100
                    ? "danger"
                    : totals.percent >= 80
                      ? "warning"
                      : "brand"
                }
                aria-label={`${Math.round(totals.percent)}% of total budget used`}
              />

              {totals.exceeded > 0 || totals.warning > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {totals.exceeded > 0 ? (
                    <Badge variant="danger">
                      {totals.exceeded} over budget
                    </Badge>
                  ) : null}
                  {totals.warning > 0 ? (
                    <Badge variant="warning">{totals.warning} nearing limit</Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={() => void handleCopyFromLastMonth()}>
              <Copy className="size-4" />
              Copy last month
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              New budget
            </Button>
          </div>
        </div>
      </div>

      {/* Budget cards */}
      {budgets.length === 0 ? (
        <div className="glass glow-border overflow-hidden">
          <EmptyState
            icon={PiggyBank}
            title={`No budgets for ${monthLabel(year, month)}`}
            description="Set a cap on the categories that tend to run away from you. You will be warned at 80% and flagged once you go over."
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                Create your first budget
              </Button>
            }
            secondaryAction={
              <Button variant="secondary" onClick={() => void handleCopyFromLastMonth()}>
                Copy from last month
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {budgets.map((budget, index) => {
              const status = STATUS[budget.status];
              const name = budget.category?.name ?? "Overall spending";

              return (
                <motion.article
                  key={budget.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{
                    duration: 0.5,
                    delay: Math.min(index * 0.05, 0.3),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="glass glow-border group relative overflow-hidden p-5 transition-all duration-500 ease-smooth hover:-translate-y-1 hover:shadow-lift"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {budget.category ? (
                        <CategoryIcon
                          name={budget.category.name}
                          icon={budget.category.icon}
                          gradientFrom={budget.category.gradientFrom}
                          gradientTo={budget.category.gradientTo}
                        />
                      ) : (
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15">
                          <PiggyBank className="size-[18px] text-primary-300" />
                        </span>
                      )}

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {name}
                        </p>
                        <p className="text-[11px] text-subtle">
                          {budget.transactionCount}{" "}
                          {budget.transactionCount === 1 ? "entry" : "entries"}
                        </p>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="shrink-0 rounded-lg p-1.5 text-subtle opacity-0 transition-all hover:bg-white/[0.08] hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                          aria-label={`Actions for ${name} budget`}
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(budget);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          destructive
                          onSelect={() => setDeleting(budget)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-2">
                    <div>
                      <p className="tabular text-xl font-semibold text-white">
                        {formatMoney(budget.spent)}
                      </p>
                      <p className="tabular text-[11px] text-subtle">
                        of {formatMoney(budget.amount)}
                      </p>
                    </div>

                    <Badge variant={status.badge}>{status.label}</Badge>
                  </div>

                  <div className="mt-3 space-y-2">
                    <Progress
                      value={Math.min(budget.percentUsed, 100)}
                      tone={status.tone}
                      aria-label={`${name}: ${Math.round(budget.percentUsed)}% used`}
                    />

                    <div className="flex items-center justify-between text-[11px]">
                      <span className={status.text}>
                        {Math.round(budget.percentUsed)}% used
                      </span>
                      <span
                        className={
                          budget.remaining >= 0 ? "text-muted-foreground" : "text-danger"
                        }
                      >
                        {budget.remaining >= 0
                          ? `${formatMoney(budget.remaining)} left`
                          : `${formatMoney(Math.abs(budget.remaining))} over`}
                      </span>
                    </div>
                  </div>

                  {/* Pace projection — only meaningful mid-month. */}
                  {budget.status !== "exceeded" && budget.projectedSpend > 0 ? (
                    <div className="mt-3 flex items-center gap-1.5 border-t border-white/[0.06] pt-3 text-[11px] text-subtle">
                      <TrendingUp className="size-3" />
                      Projected {formatMoney(budget.projectedSpend)} by month end
                      {budget.dailyAllowance > 0 ? (
                        <span className="ml-auto">
                          {formatMoney(budget.dailyAllowance)}/day left
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <BudgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        budget={editing}
        year={year}
        month={month}
        existingCategoryIds={budgets.map((budget) => budget.categoryId)}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this budget?</AlertDialogTitle>
            <AlertDialogDescription>
              The transactions stay exactly as they are — only the cap for{" "}
              {deleting?.category?.name ?? "overall spending"} in{" "}
              {monthLabel(year, month)} is removed.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={pending}
            >
              {pending ? "Removing…" : "Remove budget"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
