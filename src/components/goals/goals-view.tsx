"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/shared/empty-state";
import { GoalDialog } from "@/components/goals/goal-dialog";
import { usePreferences } from "@/components/providers/preferences-provider";
import { currencySymbol } from "@/lib/currency";
import { getCategoryIcon } from "@/lib/categories";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { contributeToGoal, deleteGoal, setGoalStatus } from "@/server/actions/goals";
import type { GoalStatus } from "@prisma/client";
import type { GoalDTO } from "@/types";

type Filter = "ACTIVE" | "COMPLETED" | "ARCHIVED";

export function GoalsView({ goals }: { goals: GoalDTO[] }) {
  const router = useRouter();
  const { formatMoney, dateFormat } = usePreferences();

  const [filter, setFilter] = React.useState<Filter>("ACTIVE");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<GoalDTO | null>(null);
  const [deleting, setDeleting] = React.useState<GoalDTO | null>(null);
  const [pending, setPending] = React.useState(false);

  const counts = React.useMemo(
    () => ({
      ACTIVE: goals.filter((goal) => goal.status === "ACTIVE").length,
      COMPLETED: goals.filter((goal) => goal.status === "COMPLETED").length,
      ARCHIVED: goals.filter((goal) => goal.status === "ARCHIVED").length,
    }),
    [goals],
  );

  const visible = goals.filter((goal) => goal.status === filter);

  async function handleDelete() {
    if (!deleting) return;
    setPending(true);

    const result = await deleteGoal(deleting.id);
    setPending(false);
    setDeleting(null);

    if (result.ok) {
      toast.success("Goal deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleStatus(goal: GoalDTO, status: GoalStatus) {
    const result = await setGoalStatus(goal.id, status);
    if (result.ok) {
      toast.success(
        status === "ARCHIVED"
          ? "Goal archived"
          : status === "COMPLETED"
            ? "Goal marked complete"
            : "Goal reactivated",
      );
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList>
            <TabsTrigger value="ACTIVE">Active ({counts.ACTIVE})</TabsTrigger>
            <TabsTrigger value="COMPLETED">Done ({counts.COMPLETED})</TabsTrigger>
            <TabsTrigger value="ARCHIVED">Archived ({counts.ARCHIVED})</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          New goal
        </Button>
      </div>

      {visible.length === 0 ? (
        <div className="glass glow-border overflow-hidden">
          <EmptyState
            icon={Target}
            title={
              filter === "ACTIVE"
                ? "No active goals"
                : filter === "COMPLETED"
                  ? "Nothing finished yet"
                  : "Nothing archived"
            }
            description={
              filter === "ACTIVE"
                ? "Set a target with a deadline and we work out the monthly contribution that gets you there."
                : filter === "COMPLETED"
                  ? "Goals you fully fund end up here."
                  : "Goals you park for later end up here."
            }
            action={
              filter === "ACTIVE" ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  Create a goal
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {visible.map((goal, index) => {
              const Icon = getCategoryIcon(goal.icon);
              const overdue =
                goal.daysLeft !== null &&
                goal.daysLeft < 0 &&
                goal.status === "ACTIVE";

              return (
                <motion.article
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{
                    duration: 0.5,
                    delay: Math.min(index * 0.05, 0.3),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="glass glow-border group relative flex flex-col overflow-hidden p-5 transition-all duration-500 ease-smooth hover:-translate-y-1 hover:shadow-lift"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-[0.12] blur-3xl transition-opacity duration-500 group-hover:opacity-25"
                    style={{
                      background: `radial-gradient(circle, ${goal.gradientFrom}, transparent 70%)`,
                    }}
                  />

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="grid size-11 shrink-0 place-items-center rounded-xl"
                        style={{
                          background: `linear-gradient(135deg, ${goal.gradientFrom}, ${goal.gradientTo})`,
                          boxShadow: `0 8px 24px -12px ${goal.gradientFrom}`,
                        }}
                      >
                        <Icon className="size-5 text-white" strokeWidth={2} />
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {goal.name}
                        </p>
                        {goal.deadline ? (
                          <p
                            className={cn(
                              "flex items-center gap-1 text-[11px]",
                              overdue ? "text-danger" : "text-subtle",
                            )}
                          >
                            <CalendarClock className="size-3" />
                            {overdue
                              ? `${Math.abs(goal.daysLeft!)} days overdue`
                              : goal.daysLeft !== null
                                ? `${goal.daysLeft} days left`
                                : formatDate(goal.deadline, dateFormat)}
                          </p>
                        ) : (
                          <p className="text-[11px] text-subtle">No deadline</p>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="shrink-0 rounded-lg p-1.5 text-subtle opacity-0 transition-all hover:bg-white/[0.08] hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                          aria-label={`Actions for ${goal.name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(goal);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil />
                          Edit
                        </DropdownMenuItem>

                        {goal.status !== "COMPLETED" ? (
                          <DropdownMenuItem
                            onSelect={() => void handleStatus(goal, "COMPLETED")}
                          >
                            <CheckCircle2 />
                            Mark complete
                          </DropdownMenuItem>
                        ) : null}

                        {goal.status !== "ARCHIVED" ? (
                          <DropdownMenuItem
                            onSelect={() => void handleStatus(goal, "ARCHIVED")}
                          >
                            <Archive />
                            Archive
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() => void handleStatus(goal, "ACTIVE")}
                          >
                            <RotateCcw />
                            Reactivate
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem destructive onSelect={() => setDeleting(goal)}>
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-2">
                    <div>
                      <p className="tabular text-xl font-semibold text-white">
                        {formatMoney(goal.currentAmount)}
                      </p>
                      <p className="tabular text-[11px] text-subtle">
                        of {formatMoney(goal.targetAmount)}
                      </p>
                    </div>

                    {goal.status === "COMPLETED" ? (
                      <Badge variant="success">
                        <CheckCircle2 className="size-3" />
                        Funded
                      </Badge>
                    ) : (
                      <span className="tabular text-sm font-semibold text-white">
                        {Math.round(goal.percentComplete)}%
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    <Progress
                      value={goal.percentComplete}
                      from={goal.gradientFrom}
                      to={goal.gradientTo}
                      aria-label={`${goal.name}: ${Math.round(goal.percentComplete)}% funded`}
                    />
                  </div>

                  {goal.status === "ACTIVE" ? (
                    <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-muted-foreground">
                        {formatMoney(goal.remaining)} to go
                      </span>
                      {goal.requiredPerMonth !== null ? (
                        <span className="text-primary-200">
                          {formatMoney(goal.requiredPerMonth)}/month
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {goal.notes ? (
                    <p className="mt-3 line-clamp-2 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-muted-foreground">
                      {goal.notes}
                    </p>
                  ) : null}

                  {goal.status === "ACTIVE" ? (
                    <div className="mt-4 pt-1">
                      <ContributeButton goal={goal} />
                    </div>
                  ) : null}
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <GoalDialog open={dialogOpen} onOpenChange={setDialogOpen} goal={editing} />

      <AlertDialog open={Boolean(deleting)} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleting?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              The goal and its contribution history are removed permanently. Your
              transactions are not affected.
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
              {pending ? "Deleting…" : "Delete goal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Popover for logging a contribution against a goal. */
function ContributeButton({ goal }: { goal: GoalDTO }) {
  const router = useRouter();
  const { currency, formatMoney } = usePreferences();

  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter an amount greater than zero.");
      return;
    }

    setPending(true);
    const result = await contributeToGoal({ goalId: goal.id, amount: value, note });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      result.data.completed
        ? `"${goal.name}" is fully funded`
        : `Added ${formatMoney(value)} to "${goal.name}"`,
    );

    setAmount("");
    setNote("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="w-full">
          <Plus className="size-3.5" />
          Add contribution
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor={`contribute-${goal.id}`}
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Amount
            </label>
            <Input
              id={`contribute-${goal.id}`}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              autoFocus
              className="tabular"
              icon={
                <span className="text-sm font-medium">{currencySymbol(currency)}</span>
              }
            />
            <p className="text-[11px] text-subtle">
              {formatMoney(goal.remaining)} still needed
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`note-${goal.id}`}
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Note
            </label>
            <Input
              id={`note-${goal.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional"
              maxLength={140}
            />
          </div>

          <Button type="submit" size="sm" className="w-full" loading={pending}>
            Add contribution
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
