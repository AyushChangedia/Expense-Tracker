"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";

/** The paired add-expense / add-income actions used in page headers. */
export function QuickAddButtons() {
  const { openCreate } = useTransactionDialog();

  return (
    <>
      <Button variant="secondary" onClick={() => openCreate({ type: "EXPENSE" })}>
        <Minus className="size-4 text-danger" />
        Add expense
      </Button>
      <Button onClick={() => openCreate({ type: "INCOME" })}>
        <Plus className="size-4" />
        Add income
      </Button>
    </>
  );
}
