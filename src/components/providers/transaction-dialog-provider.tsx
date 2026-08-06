"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TransactionForm,
  type TransactionFormValues,
} from "@/components/transactions/transaction-form";
import {
  createTransaction,
  deleteTransaction,
  restoreTransactions,
  updateTransaction,
  type DeletedTransactionSnapshot,
} from "@/server/actions/transactions";
import type { TransactionDTO } from "@/types";

type DialogState =
  | { mode: "closed" }
  | { mode: "create"; initial?: Partial<TransactionFormValues> }
  | { mode: "edit"; transaction: TransactionDTO };

type TransactionDialogContextValue = {
  openCreate: (initial?: Partial<TransactionFormValues>) => void;
  openEdit: (transaction: TransactionDTO) => void;
  close: () => void;
  /** Deletes with an undo toast. Shared by the table, calendar, and detail views. */
  deleteWithUndo: (transaction: Pick<TransactionDTO, "id" | "description">) => Promise<void>;
  restore: (snapshots: DeletedTransactionSnapshot[]) => Promise<void>;
};

const TransactionDialogContext =
  React.createContext<TransactionDialogContextValue | null>(null);

/**
 * Owns the single add/edit transaction dialog for the whole app.
 *
 * Keeping one instance at the layout level means the command palette, the
 * floating quick-add button, the calendar, and every table row open the same
 * form — no duplicated state, no competing modals.
 */
export function TransactionDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = React.useState<DialogState>({ mode: "closed" });
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const close = React.useCallback(() => {
    setState({ mode: "closed" });
    setError(null);
    setFieldErrors({});
  }, []);

  const openCreate = React.useCallback(
    (initial?: Partial<TransactionFormValues>) => {
      setError(null);
      setFieldErrors({});
      setState({ mode: "create", initial });
    },
    [],
  );

  const openEdit = React.useCallback((transaction: TransactionDTO) => {
    setError(null);
    setFieldErrors({});
    setState({ mode: "edit", transaction });
  }, []);

  const restore = React.useCallback(
    async (snapshots: DeletedTransactionSnapshot[]) => {
      const result = await restoreTransactions(snapshots);
      if (result.ok) {
        toast.success(
          snapshots.length === 1
            ? "Transaction restored"
            : `${result.data} transactions restored`,
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    },
    [router],
  );

  const deleteWithUndo = React.useCallback(
    async (transaction: Pick<TransactionDTO, "id" | "description">) => {
      const result = await deleteTransaction({ id: transaction.id });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const snapshot = result.data;

      // The snapshot carries the original id, so "Undo" is a true restore
      // rather than a lookalike copy.
      toast.success(`Deleted "${transaction.description}"`, {
        action: {
          label: "Undo",
          onClick: () => void restore([snapshot]),
        },
        duration: 7000,
      });

      router.refresh();
    },
    [restore, router],
  );

  async function handleSubmit(values: TransactionFormValues) {
    setPending(true);
    setError(null);
    setFieldErrors({});

    const result =
      state.mode === "edit"
        ? await updateTransaction({ ...values, id: state.transaction.id })
        : await createTransaction(values);

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    toast.success(
      state.mode === "edit" ? "Transaction updated" : "Transaction added",
    );
    close();
    router.refresh();
  }

  const value = React.useMemo<TransactionDialogContextValue>(
    () => ({ openCreate, openEdit, close, deleteWithUndo, restore }),
    [openCreate, openEdit, close, deleteWithUndo, restore],
  );

  const isOpen = state.mode !== "closed";
  const isEdit = state.mode === "edit";

  return (
    <TransactionDialogContext.Provider value={value}>
      {children}

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && !pending) close();
        }}
      >
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit transaction" : "Add transaction"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the details and save your changes."
                : "Record income or an expense. Tags and notes are optional."}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="pb-6">
            {isOpen ? (
              <TransactionForm
                // Remounting on mode change resets the form to fresh defaults.
                key={isEdit ? state.transaction.id : "create"}
                initial={
                  isEdit
                    ? state.transaction
                    : state.mode === "create"
                      ? state.initial
                      : undefined
                }
                onSubmit={handleSubmit}
                onCancel={close}
                submitLabel={isEdit ? "Save changes" : "Add transaction"}
                pending={pending}
                error={error}
                fieldErrors={fieldErrors}
              />
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </TransactionDialogContext.Provider>
  );
}

export function useTransactionDialog(): TransactionDialogContextValue {
  const context = React.useContext(TransactionDialogContext);
  if (!context) {
    throw new Error(
      "useTransactionDialog must be used inside a TransactionDialogProvider",
    );
  }
  return context;
}
