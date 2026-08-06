"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Amount } from "@/components/shared/amount";
import { CategoryIcon } from "@/components/shared/category-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { RecurringDialog } from "@/components/recurring/recurring-dialog";
import { usePreferences } from "@/components/providers/preferences-provider";
import { formatDate, frequencyLabel, relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  deleteRecurring,
  runRecurringNow,
  toggleRecurringActive,
} from "@/server/actions/recurring";
import type { RecurringDTO } from "@/types";

export function RecurringView({ rules }: { rules: RecurringDTO[] }) {
  const router = useRouter();
  const { formatMoney, dateFormat } = usePreferences();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RecurringDTO | null>(null);
  const [deleting, setDeleting] = React.useState<RecurringDTO | null>(null);
  const [deleteGenerated, setDeleteGenerated] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const active = rules.filter((rule) => rule.isActive);
  const paused = rules.filter((rule) => !rule.isActive);

  const monthlyImpact = React.useMemo(() => {
    // Normalise every cadence to a monthly figure so the totals compare.
    const perMonth = (rule: RecurringDTO) => {
      const factor = {
        DAILY: 30.44,
        WEEKLY: 4.348,
        MONTHLY: 1,
        YEARLY: 1 / 12,
      }[rule.frequency];
      return (rule.amount * factor) / Math.max(1, rule.interval);
    };

    return active.reduce(
      (acc, rule) => {
        const value = perMonth(rule);
        if (rule.type === "INCOME") acc.income += value;
        else acc.expenses += value;
        return acc;
      },
      { income: 0, expenses: 0 },
    );
  }, [active]);

  async function handleToggle(rule: RecurringDTO) {
    const result = await toggleRecurringActive(rule.id);
    if (result.ok) {
      toast.success(result.data ? "Rule resumed" : "Rule paused");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setPending(true);

    const result = await deleteRecurring(deleting.id, { deleteGenerated });
    setPending(false);
    setDeleting(null);
    setDeleteGenerated(false);

    if (result.ok) {
      toast.success("Recurring rule deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleRunNow() {
    const result = await runRecurringNow();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.data > 0
        ? `${result.data} ${result.data === 1 ? "entry" : "entries"} posted`
        : "Nothing was due",
    );
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Monthly impact summary */}
      {active.length > 0 ? (
        <div className="glass glow-border grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-subtle">
              Recurring income
            </p>
            <p className="tabular text-lg font-semibold text-success">
              {formatMoney(monthlyImpact.income)}
              <span className="text-xs font-normal text-subtle"> /month</span>
            </p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-subtle">
              Recurring expenses
            </p>
            <p className="tabular text-lg font-semibold text-danger">
              {formatMoney(monthlyImpact.expenses)}
              <span className="text-xs font-normal text-subtle"> /month</span>
            </p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-subtle">
              Net effect
            </p>
            <p
              className={cn(
                "tabular text-lg font-semibold",
                monthlyImpact.income - monthlyImpact.expenses >= 0
                  ? "text-white"
                  : "text-danger",
              )}
            >
              {formatMoney(monthlyImpact.income - monthlyImpact.expenses)}
              <span className="text-xs font-normal text-subtle"> /month</span>
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {rules.length} {rules.length === 1 ? "rule" : "rules"} · {active.length} active
        </p>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void handleRunNow()}>
            <RefreshCw className="size-4" />
            Run due now
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            New rule
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="glass glow-border overflow-hidden">
          <EmptyState
            icon={RefreshCw}
            title="No recurring rules yet"
            description="Rent, salary, and subscriptions post themselves on schedule so you never have to remember them."
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                Create your first rule
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-5">
          {[
            { label: "Active", items: active },
            { label: "Paused", items: paused },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section key={group.label} className="space-y-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-subtle">
                  {group.label} ({group.items.length})
                </h2>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <AnimatePresence initial={false}>
                    {group.items.map((rule, index) => (
                      <motion.article
                        key={rule.id}
                        layout
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{
                          duration: 0.45,
                          delay: Math.min(index * 0.04, 0.24),
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className={cn(
                          "glass glow-border group p-5 transition-all duration-500 ease-smooth hover:-translate-y-1 hover:shadow-lift",
                          !rule.isActive && "opacity-65",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <CategoryIcon
                              name={rule.category.name}
                              icon={rule.category.icon}
                              gradientFrom={rule.category.gradientFrom}
                              gradientTo={rule.category.gradientTo}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                {rule.description}
                              </p>
                              <p className="truncate text-[11px] text-subtle">
                                {rule.category.name} ·{" "}
                                {frequencyLabel(rule.frequency, rule.interval)}
                              </p>
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="shrink-0 rounded-lg p-1.5 text-subtle opacity-0 transition-all hover:bg-white/[0.08] hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                                aria-label={`Actions for ${rule.description}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setEditing(rule);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => void handleToggle(rule)}
                              >
                                {rule.isActive ? <Pause /> : <Play />}
                                {rule.isActive ? "Pause" : "Resume"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onSelect={() => setDeleting(rule)}
                              >
                                <Trash2 />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="mt-4 flex items-end justify-between gap-2">
                          <Amount
                            value={rule.amount}
                            type={rule.type}
                            className="text-xl"
                          />
                          <Badge variant={rule.isActive ? "success" : "secondary"}>
                            {rule.isActive ? "Active" : "Paused"}
                          </Badge>
                        </div>

                        <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-3 text-[11px]">
                          <p className="flex items-center gap-1.5 text-muted-foreground">
                            <CalendarClock className="size-3 shrink-0" />
                            {rule.isActive ? (
                              <>
                                Next {relativeDay(rule.nextRunDate, dateFormat)}
                              </>
                            ) : (
                              <>Paused — resumes from today</>
                            )}
                          </p>

                          <p className="text-subtle">
                            {rule.generatedCount > 0
                              ? `${rule.generatedCount} posted so far`
                              : "Nothing posted yet"}
                            {rule.endDate
                              ? ` · ends ${formatDate(rule.endDate, dateFormat)}`
                              : ""}
                          </p>
                        </div>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            ))}
        </div>
      )}

      <RecurringDialog open={dialogOpen} onOpenChange={setDialogOpen} rule={editing} />

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={() => {
          setDeleting(null);
          setDeleteGenerated(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{deleting?.description}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The rule stops posting. Transactions it already created stay in your
              history unless you say otherwise.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleting && deleting.generatedCount > 0 ? (
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
              <Checkbox
                checked={deleteGenerated}
                onCheckedChange={(checked) => setDeleteGenerated(checked === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="block text-white">
                  Also delete the {deleting.generatedCount}{" "}
                  {deleting.generatedCount === 1 ? "transaction" : "transactions"} it
                  created
                </span>
                <span className="block text-xs text-subtle">
                  This cannot be undone.
                </span>
              </span>
            </label>
          ) : null}

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
              {pending ? "Deleting…" : "Delete rule"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
