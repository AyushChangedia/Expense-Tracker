"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import { isSameMonth, isToday } from "date-fns";

import { Button } from "@/components/ui/button";
import { Amount } from "@/components/shared/amount";
import { CategoryIcon } from "@/components/shared/category-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import {
  dayKey,
  monthGrid,
  monthLabel,
  shiftMonth,
  weekdayLabels,
  formatDate,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TransactionDTO } from "@/types";

export function CalendarView({
  transactions,
  year,
  month,
}: {
  transactions: TransactionDTO[];
  year: number;
  month: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { formatMoney, weekStart, dateFormat } = usePreferences();
  const { openCreate, openEdit } = useTransactionDialog();

  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);

  const weekStartsOn = weekStart === 1 ? 1 : 0;
  const days = React.useMemo(
    () => monthGrid(year, month, weekStartsOn),
    [year, month, weekStartsOn],
  );

  // Bucket transactions by calendar day once, rather than filtering per cell.
  const byDay = React.useMemo(() => {
    const map = new Map<string, { items: TransactionDTO[]; income: number; expense: number }>();
    for (const transaction of transactions) {
      const key = dayKey(transaction.date);
      const bucket = map.get(key) ?? { items: [], income: 0, expense: 0 };
      bucket.items.push(transaction);
      if (transaction.type === "INCOME") bucket.income += transaction.amount;
      else bucket.expense += transaction.amount;
      map.set(key, bucket);
    }
    return map;
  }, [transactions]);

  const monthTotals = React.useMemo(
    () =>
      transactions.reduce(
        (acc, transaction) => {
          if (transaction.type === "INCOME") acc.income += transaction.amount;
          else acc.expense += transaction.amount;
          return acc;
        },
        { income: 0, expense: 0 },
      ),
    [transactions],
  );

  // The busiest day sets the scale for the intensity shading.
  const peakExpense = React.useMemo(() => {
    let peak = 0;
    for (const bucket of byDay.values()) peak = Math.max(peak, bucket.expense);
    return peak;
  }, [byDay]);

  function goToMonth(delta: number) {
    const next = shiftMonth(year, month, delta);
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(next.year));
    params.set("month", String(next.month));
    setSelectedDay(null);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const selected = selectedDay ? byDay.get(selectedDay) : null;
  const reference = new Date(year, month - 1, 1);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="glass glow-border overflow-hidden">
        {/* Month header */}
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => goToMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <p className="min-w-[150px] text-center text-sm font-semibold text-white">
              {monthLabel(year, month)}
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => goToMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-success" />
              <span className="tabular text-muted-foreground">
                {formatMoney(monthTotals.income, { compact: true })}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-danger" />
              <span className="tabular text-muted-foreground">
                {formatMoney(monthTotals.expense, { compact: true })}
              </span>
            </span>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-white/[0.06]">
          {weekdayLabels(weekStartsOn).map((label) => (
            <div
              key={label}
              className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const key = dayKey(day);
            const bucket = byDay.get(key);
            const inMonth = isSameMonth(day, reference);
            const today = isToday(day);
            const isSelected = selectedDay === key;

            // Shade proportionally to that day's spend against the month's peak.
            const intensity =
              peakExpense > 0 && bucket ? Math.min(bucket.expense / peakExpense, 1) : 0;

            return (
              <motion.button
                key={key}
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.006, 0.25) }}
                onClick={() => setSelectedDay(isSelected ? null : key)}
                onDoubleClick={() => openCreate({ type: "EXPENSE", date: key })}
                className={cn(
                  "group relative flex min-h-[86px] flex-col gap-1 border-b border-r border-white/[0.04] p-2 text-left transition-colors duration-200",
                  !inMonth && "opacity-35",
                  isSelected ? "bg-primary/[0.10]" : "hover:bg-white/[0.03]",
                )}
                aria-label={`${formatDate(key, dateFormat)}${
                  bucket ? `, ${bucket.items.length} transactions` : ", no transactions"
                }`}
                aria-pressed={isSelected}
              >
                {intensity > 0 ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: `linear-gradient(to top, rgba(239,68,68,${
                        0.05 + intensity * 0.16
                      }), transparent 70%)`,
                    }}
                  />
                ) : null}

                <span className="relative flex items-center justify-between">
                  <span
                    className={cn(
                      "tabular grid size-6 place-items-center rounded-md text-xs font-medium",
                      today
                        ? "bg-brand-gradient text-white shadow-[0_0_12px_-3px_rgba(139,92,246,0.9)]"
                        : isSelected
                          ? "text-white"
                          : "text-muted-foreground",
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {inMonth ? (
                    <span className="rounded p-0.5 text-subtle opacity-0 transition-opacity group-hover:opacity-100">
                      <Plus className="size-3" />
                    </span>
                  ) : null}
                </span>

                {bucket ? (
                  <span className="relative mt-auto space-y-0.5">
                    {bucket.expense > 0 ? (
                      <span className="tabular block truncate text-[10px] font-medium text-danger">
                        −{formatMoney(bucket.expense, { compact: true })}
                      </span>
                    ) : null}
                    {bucket.income > 0 ? (
                      <span className="tabular block truncate text-[10px] font-medium text-success">
                        +{formatMoney(bucket.income, { compact: true })}
                      </span>
                    ) : null}
                    <span className="block text-[9px] text-subtle">
                      {bucket.items.length}{" "}
                      {bucket.items.length === 1 ? "entry" : "entries"}
                    </span>
                  </span>
                ) : null}
              </motion.button>
            );
          })}
        </div>

        <p className="border-t border-white/[0.06] px-5 py-2.5 text-[11px] text-subtle">
          Click a day to see its transactions · double-click to add one
        </p>
      </div>

      {/* Day detail panel */}
      <div className="glass glow-border flex h-fit flex-col overflow-hidden xl:sticky xl:top-24">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] p-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {selectedDay ? formatDate(selectedDay, dateFormat) : "Pick a day"}
            </p>
            <p className="text-[11px] text-subtle">
              {selected
                ? `${selected.items.length} ${
                    selected.items.length === 1 ? "transaction" : "transactions"
                  }`
                : "Select a date on the calendar"}
            </p>
          </div>

          {selectedDay ? (
            <Button
              size="sm"
              onClick={() => openCreate({ type: "EXPENSE", date: selectedDay })}
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          {!selectedDay ? (
            <EmptyState
              key="none"
              icon={CalendarDays}
              title="No day selected"
              description="Click any date to see what you spent, or double-click to add an entry to it."
              compact
            />
          ) : !selected || selected.items.length === 0 ? (
            <EmptyState
              key="empty"
              icon={CalendarDays}
              title="Nothing on this day"
              description="No transactions were recorded. Add one to fill the gap."
              compact
              action={
                <Button
                  size="sm"
                  onClick={() => openCreate({ type: "EXPENSE", date: selectedDay })}
                >
                  Add a transaction
                </Button>
              }
            />
          ) : (
            <motion.div
              key={selectedDay}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="grid grid-cols-2 gap-px border-b border-white/[0.06] bg-white/[0.04]">
                <div className="bg-surface p-4">
                  <p className="text-[10px] uppercase tracking-wider text-subtle">In</p>
                  <p className="tabular text-sm font-semibold text-success">
                    {formatMoney(selected.income)}
                  </p>
                </div>
                <div className="bg-surface p-4">
                  <p className="text-[10px] uppercase tracking-wider text-subtle">Out</p>
                  <p className="tabular text-sm font-semibold text-danger">
                    {formatMoney(selected.expense)}
                  </p>
                </div>
              </div>

              <ul className="max-h-[420px] divide-y divide-white/[0.05] overflow-y-auto">
                {selected.items.map((transaction) => (
                  <li key={transaction.id}>
                    <button
                      type="button"
                      onClick={() => openEdit(transaction)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-white/[0.03]"
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
                        <span className="block truncate text-[11px] text-subtle">
                          {transaction.category.name}
                        </span>
                      </span>
                      <Amount
                        value={transaction.amount}
                        type={transaction.type}
                        className="shrink-0 text-sm"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
