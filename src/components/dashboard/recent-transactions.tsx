"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, MoreHorizontal, Pencil, Copy, Trash2, ListOrdered } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Amount } from "@/components/shared/amount";
import { CategoryIcon } from "@/components/shared/category-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/page-header";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import { relativeDay } from "@/lib/dates";
import { duplicateTransaction } from "@/server/actions/transactions";
import type { TransactionDTO } from "@/types";

export function RecentTransactions({
  transactions,
}: {
  transactions: TransactionDTO[];
}) {
  const router = useRouter();
  const { dateFormat } = usePreferences();
  const { openCreate, openEdit, deleteWithUndo } = useTransactionDialog();

  async function handleDuplicate(id: string) {
    const result = await duplicateTransaction({ id });
    if (result.ok) {
      toast.success("Duplicated to today");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="glass glow-border flex h-full flex-col overflow-hidden">
      <div className="p-5 pb-4 sm:p-6 sm:pb-4">
        <SectionHeading
          title="Recent transactions"
          description="Your latest activity across every category"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/transactions">
                View all
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        />
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="No transactions yet"
          description="Add your first entry and the dashboard fills in immediately."
          compact
          action={
            <Button size="sm" onClick={() => openCreate({ type: "EXPENSE" })}>
              Add a transaction
            </Button>
          }
        />
      ) : (
        <ul className="flex-1 divide-y divide-white/[0.05]">
          {transactions.map((transaction, index) => (
            <motion.li
              key={transaction.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.4,
                delay: Math.min(index * 0.04, 0.3),
                ease: [0.16, 1, 0.3, 1],
              }}
              className="group flex items-center gap-3 px-5 py-3 transition-colors duration-200 hover:bg-white/[0.03] sm:px-6"
            >
              <CategoryIcon
                name={transaction.category.name}
                icon={transaction.category.icon}
                gradientFrom={transaction.category.gradientFrom}
                gradientTo={transaction.category.gradientTo}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {transaction.description}
                </p>
                <p className="truncate text-xs text-subtle">
                  {transaction.category.name} ·{" "}
                  {relativeDay(transaction.date, dateFormat)}
                  {transaction.tags.length > 0
                    ? ` · ${transaction.tags.map((tag) => `#${tag.name}`).join(" ")}`
                    : ""}
                </p>
              </div>

              <Amount
                value={transaction.amount}
                type={transaction.type}
                className="shrink-0 text-sm"
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg p-1.5 text-subtle opacity-0 transition-all duration-200 hover:bg-white/[0.08] hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Actions for ${transaction.description}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => openEdit(transaction)}>
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => void handleDuplicate(transaction.id)}
                  >
                    <Copy />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    destructive
                    onSelect={() => void deleteWithUndo(transaction)}
                  >
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
