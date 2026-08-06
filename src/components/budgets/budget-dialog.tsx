"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormError } from "@/components/auth/auth-card";
import { CategoryIcon } from "@/components/shared/category-chip";
import { usePreferences } from "@/components/providers/preferences-provider";
import { currencySymbol } from "@/lib/currency";
import { monthLabel } from "@/lib/dates";
import { budgetSchema } from "@/lib/validations";
import { createBudget, updateBudget } from "@/server/actions/budgets";
import type { BudgetProgress } from "@/types";

const OVERALL = "__overall__";

const formSchema = budgetSchema;
type FormValues = z.input<typeof formSchema>;

export function BudgetDialog({
  open,
  onOpenChange,
  budget,
  year,
  month,
  existingCategoryIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing. */
  budget?: BudgetProgress | null;
  year: number;
  month: number;
  /** Categories that already have a budget this month, to avoid duplicates. */
  existingCategoryIds: (string | null)[];
}) {
  const router = useRouter();
  const { categories, currency } = usePreferences();

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEdit = Boolean(budget);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      categoryId: budget?.categoryId ?? null,
      amount: budget?.amount ?? ("" as unknown as number),
      month,
      year,
    },
  });

  // Reset whenever the dialog opens for a different target.
  React.useEffect(() => {
    if (!open) return;
    form.reset({
      categoryId: budget?.categoryId ?? null,
      amount: budget?.amount ?? ("" as unknown as number),
      month,
      year,
    });
    setError(null);
  }, [open, budget, month, year, form]);

  // Only expense categories can be budgeted, and only ones not already taken
  // (the category currently being edited stays available).
  const availableCategories = React.useMemo(() => {
    const taken = new Set(
      existingCategoryIds.filter(
        (id): id is string => Boolean(id) && id !== budget?.categoryId,
      ),
    );
    return categories.filter(
      (category) =>
        (category.kind === "EXPENSE" || category.kind === "BOTH") &&
        !taken.has(category.id),
    );
  }, [categories, existingCategoryIds, budget?.categoryId]);

  const overallTaken =
    existingCategoryIds.includes(null) && budget?.categoryId !== null;

  async function onSubmit(values: FormValues) {
    setPending(true);
    setError(null);

    const payload = {
      categoryId: values.categoryId || null,
      amount: Number(values.amount),
      month: Number(values.month),
      year: Number(values.year),
    };

    const result = isEdit
      ? await updateBudget({ ...payload, id: budget!.id })
      : await createBudget(payload);

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success(isEdit ? "Budget updated" : "Budget created");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit budget" : "New budget"}</DialogTitle>
          <DialogDescription>
            Set a spending cap for {monthLabel(year, month)}. You will be warned
            at 80% and flagged red once it is exceeded.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="pb-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormError message={error} />

            <Field
              label="Applies to"
              htmlFor="categoryId"
              error={form.formState.errors.categoryId?.message}
              hint="An overall budget covers every expense category combined."
            >
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? OVERALL}
                    onValueChange={(value) =>
                      field.onChange(value === OVERALL ? null : value)
                    }
                  >
                    <SelectTrigger id="categoryId">
                      <SelectValue placeholder="Pick a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={OVERALL} disabled={overallTaken}>
                        Overall spending
                        {overallTaken ? " (already set)" : ""}
                      </SelectItem>
                      {availableCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <span className="flex items-center gap-2.5">
                            <CategoryIcon
                              name={category.name}
                              icon={category.icon}
                              gradientFrom={category.gradientFrom}
                              gradientTo={category.gradientTo}
                              size="sm"
                            />
                            {category.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field
              label="Monthly limit"
              htmlFor="amount"
              error={form.formState.errors.amount?.message}
            >
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0.00"
                autoFocus
                className="tabular font-semibold"
                icon={
                  <span className="text-sm font-medium">
                    {currencySymbol(currency)}
                  </span>
                }
                invalid={Boolean(form.formState.errors.amount)}
                {...form.register("amount", { valueAsNumber: true })}
              />
            </Field>

            <input type="hidden" {...form.register("month", { valueAsNumber: true })} />
            <input type="hidden" {...form.register("year", { valueAsNumber: true })} />

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                {isEdit ? "Save changes" : "Create budget"}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
