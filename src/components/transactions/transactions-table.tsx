"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  ListOrdered,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Amount } from "@/components/shared/amount";
import { CategoryIcon } from "@/components/shared/category-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import { useTransactionFilters } from "@/hooks/use-transaction-filters";
import { formatDate, relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  bulkDeleteTransactions,
  duplicateTransaction,
  toggleTransactionPin,
} from "@/server/actions/transactions";
import type { TransactionDTO, TransactionPage } from "@/types";

const COLUMNS = [
  { key: "date" as const, label: "Date", className: "w-[130px]" },
  { key: "description" as const, label: "Description", className: "" },
  { key: "category" as const, label: "Category", className: "w-[170px]" },
  { key: "amount" as const, label: "Amount", className: "w-[130px] text-right" },
];

export function TransactionsTable({ page }: { page: TransactionPage }) {
  const router = useRouter();
  const { dateFormat } = usePreferences();
  const { openCreate, openEdit, deleteWithUndo, restore } = useTransactionDialog();
  const { current, update, pending } = useTransactionFilters();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = React.useState(false);
  const [bulkPending, setBulkPending] = React.useState(false);

  // Selection is per-page; clear it whenever the visible rows change.
  React.useEffect(() => {
    setSelected(new Set());
  }, [page.items]);

  const allSelected = page.items.length > 0 && selected.size === page.items.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(
      allSelected ? new Set() : new Set(page.items.map((item) => item.id)),
    );
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSort(key: (typeof COLUMNS)[number]["key"]) {
    const sameColumn = current.sort === key;
    update({
      sort: key,
      // Clicking the active column flips direction; a new column starts desc.
      dir: sameColumn && current.dir === "desc" ? "asc" : "desc",
    });
  }

  async function handleDuplicate(id: string) {
    const result = await duplicateTransaction({ id });
    if (result.ok) {
      toast.success("Duplicated to today");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleTogglePin(transaction: TransactionDTO) {
    const result = await toggleTransactionPin({ id: transaction.id });
    if (result.ok) {
      toast.success(result.data.isPinned ? "Pinned" : "Unpinned");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    setBulkPending(true);

    const result = await bulkDeleteTransactions({ ids });
    setBulkPending(false);
    setConfirmBulk(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    const snapshots = result.data;
    setSelected(new Set());

    toast.success(`Deleted ${snapshots.length} transactions`, {
      action: {
        label: "Undo",
        onClick: () => void restore(snapshots),
      },
      duration: 8000,
    });

    router.refresh();
  }

  if (page.items.length === 0) {
    return (
      <div className="glass glow-border overflow-hidden">
        <EmptyState
          icon={ListOrdered}
          title="No transactions match"
          description="Try widening the date range, clearing a filter, or adding a new entry."
          action={
            <Button onClick={() => openCreate({ type: "EXPENSE" })}>
              Add a transaction
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "glass glow-border overflow-hidden transition-opacity duration-300",
          pending && "opacity-60",
        )}
      >
        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th scope="col" className="w-12 px-4 py-3">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all transactions on this page"
                  />
                </th>

                {COLUMNS.map((column) => {
                  const active = current.sort === column.key;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn("px-3 py-3 text-left", column.className)}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(column.key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                          column.key === "amount" && "flex-row-reverse",
                          active ? "text-white" : "text-subtle hover:text-white",
                        )}
                      >
                        {column.label}
                        {active ? (
                          current.dir === "desc" ? (
                            <ArrowDown className="size-3 text-primary-300" />
                          ) : (
                            <ArrowUp className="size-3 text-primary-300" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    </th>
                  );
                })}

                <th scope="col" className="w-12 px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody>
              <AnimatePresence initial={false}>
                {page.items.map((transaction, index) => {
                  const isSelected = selected.has(transaction.id);

                  return (
                    <motion.tr
                      key={transaction.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{
                        duration: 0.32,
                        delay: Math.min(index * 0.02, 0.16),
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className={cn(
                        "group border-b border-white/[0.04] transition-colors duration-200 last:border-0",
                        isSelected ? "bg-primary/[0.07]" : "hover:bg-white/[0.03]",
                      )}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(transaction.id)}
                          aria-label={`Select ${transaction.description}`}
                        />
                      </td>

                      <td className="px-3 py-3">
                        <span className="tabular text-xs text-muted-foreground">
                          {formatDate(transaction.date, dateFormat)}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {transaction.isPinned ? (
                            <Pin
                              className="size-3 shrink-0 text-primary-300"
                              aria-label="Pinned"
                            />
                          ) : null}

                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openEdit(transaction)}
                              className="block max-w-full truncate text-left text-sm font-medium text-white transition-colors hover:text-primary-200"
                            >
                              {transaction.description}
                            </button>

                            {transaction.tags.length > 0 || transaction.notes ? (
                              <div className="mt-0.5 flex items-center gap-1.5">
                                {transaction.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="rounded-full border px-1.5 text-[10px]"
                                    style={{
                                      borderColor: `${tag.color}40`,
                                      color: tag.color,
                                    }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                                {transaction.tags.length > 3 ? (
                                  <span className="text-[10px] text-subtle">
                                    +{transaction.tags.length - 3}
                                  </span>
                                ) : null}
                                {transaction.notes ? (
                                  <span className="truncate text-[10px] text-subtle">
                                    {transaction.notes}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <CategoryIcon
                            name={transaction.category.name}
                            icon={transaction.category.icon}
                            gradientFrom={transaction.category.gradientFrom}
                            gradientTo={transaction.category.gradientTo}
                            size="sm"
                          />
                          <span className="truncate text-xs text-muted-foreground">
                            {transaction.category.name}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-right">
                        <Amount
                          value={transaction.amount}
                          type={transaction.type}
                          className="text-sm"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <RowActions
                          transaction={transaction}
                          onEdit={() => openEdit(transaction)}
                          onDuplicate={() => void handleDuplicate(transaction.id)}
                          onTogglePin={() => void handleTogglePin(transaction)}
                          onDelete={() => void deleteWithUndo(transaction)}
                        />
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="divide-y divide-white/[0.05] md:hidden">
          <AnimatePresence initial={false}>
            {page.items.map((transaction, index) => {
              const isSelected = selected.has(transaction.id);

              return (
                <motion.li
                  key={transaction.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{
                    duration: 0.32,
                    delay: Math.min(index * 0.025, 0.2),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    isSelected && "bg-primary/[0.07]",
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(transaction.id)}
                    aria-label={`Select ${transaction.description}`}
                  />

                  <CategoryIcon
                    name={transaction.category.name}
                    icon={transaction.category.icon}
                    gradientFrom={transaction.category.gradientFrom}
                    gradientTo={transaction.category.gradientTo}
                  />

                  <button
                    type="button"
                    onClick={() => openEdit(transaction)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      {transaction.isPinned ? (
                        <Pin className="size-3 shrink-0 text-primary-300" />
                      ) : null}
                      <span className="truncate text-sm font-medium text-white">
                        {transaction.description}
                      </span>
                    </span>
                    <span className="block truncate text-[11px] text-subtle">
                      {transaction.category.name} ·{" "}
                      {relativeDay(transaction.date, dateFormat)}
                    </span>
                  </button>

                  <Amount
                    value={transaction.amount}
                    type={transaction.type}
                    className="shrink-0 text-sm"
                  />

                  <RowActions
                    transaction={transaction}
                    alwaysVisible
                    onEdit={() => openEdit(transaction)}
                    onDuplicate={() => void handleDuplicate(transaction.id)}
                    onTogglePin={() => void handleTogglePin(transaction)}
                    onDelete={() => void deleteWithUndo(transaction)}
                  />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>

      {/* Floating bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="bottom-safe-24 fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/[0.10] bg-surface/95 px-4 py-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.95)] backdrop-blur-2xl lg:bottom-8"
          >
            <span className="tabular text-sm text-white">
              <span className="font-semibold">{selected.size}</span> selected
            </span>

            <span className="h-5 w-px bg-white/[0.10]" />

            <Button
              size="sm"
              variant="destructive-ghost"
              onClick={() => setConfirmBulk(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>

            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-lg p-1.5 text-subtle transition-colors hover:bg-white/[0.08] hover:text-white"
              aria-label="Clear selection"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AlertDialog open={confirmBulk} onOpenChange={setConfirmBulk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selected.size}{" "}
              {selected.size === 1 ? "transaction" : "transactions"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be removed from your totals right away. You will get a
              chance to undo this for a few seconds afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void handleBulkDelete();
              }}
              disabled={bulkPending}
            >
              {bulkPending ? "Deleting…" : "Delete them"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RowActions({
  transaction,
  onEdit,
  onDuplicate,
  onTogglePin,
  onDelete,
  alwaysVisible = false,
}: {
  transaction: TransactionDTO;
  onEdit: () => void;
  onDuplicate: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  alwaysVisible?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded-lg p-1.5 text-subtle transition-all duration-200 hover:bg-white/[0.08] hover:text-white focus-visible:opacity-100",
            alwaysVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          aria-label={`Actions for ${transaction.description}`}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicate}>
          <Copy />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onTogglePin}>
          {transaction.isPinned ? <PinOff /> : <Pin />}
          {transaction.isPinned ? "Unpin" : "Pin"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
