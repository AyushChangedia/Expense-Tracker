"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { frequencyLabel } from "@/lib/dates";
import { recurringSchema } from "@/lib/validations";
import { cn } from "@/lib/utils";
import { createRecurring, updateRecurring } from "@/server/actions/recurring";
import type { RecurringDTO } from "@/types";
import type { RecurrenceFrequency } from "@prisma/client";

const formSchema = recurringSchema;
type FormValues = z.input<typeof formSchema>;

const FREQUENCIES: RecurrenceFrequency[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

export function RecurringDialog({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: RecurringDTO | null;
}) {
  const router = useRouter();
  const { categories, currency } = usePreferences();

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEdit = Boolean(rule);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "EXPENSE",
      amount: "" as unknown as number,
      description: "",
      categoryId: "",
      frequency: "MONTHLY",
      interval: 1,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: null,
      notes: "",
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      type: rule?.type ?? "EXPENSE",
      amount: rule?.amount ?? ("" as unknown as number),
      description: rule?.description ?? "",
      categoryId: rule?.category.id ?? "",
      frequency: rule?.frequency ?? "MONTHLY",
      interval: rule?.interval ?? 1,
      startDate: rule?.startDate
        ? rule.startDate.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      endDate: rule?.endDate ? rule.endDate.slice(0, 10) : null,
      notes: rule?.notes ?? "",
      isActive: rule?.isActive ?? true,
    });
    setError(null);
  }, [open, rule, form]);

  const type = form.watch("type");
  const frequency = form.watch("frequency") as RecurrenceFrequency;
  const interval = Number(form.watch("interval") ?? 1);

  const availableCategories = React.useMemo(
    () =>
      categories.filter(
        (category) => category.kind === "BOTH" || category.kind === type,
      ),
    [categories, type],
  );

  React.useEffect(() => {
    const current = form.getValues("categoryId");
    if (current && !availableCategories.some((item) => item.id === current)) {
      form.setValue("categoryId", "");
    }
  }, [availableCategories, form]);

  async function onSubmit(values: FormValues) {
    setPending(true);
    setError(null);

    const payload = {
      type: values.type,
      amount: Number(values.amount),
      description: String(values.description).trim(),
      categoryId: values.categoryId,
      frequency: values.frequency,
      interval: Number(values.interval ?? 1),
      startDate: values.startDate,
      endDate: values.endDate ? values.endDate : null,
      notes: String(values.notes ?? ""),
      isActive: Boolean(values.isActive),
    };

    const result = isEdit
      ? await updateRecurring({ ...payload, id: rule!.id })
      : await createRecurring(payload);

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    // A rule starting in the past posts its backlog straight away; say so
    // rather than letting rows appear unexplained.
    const generated = result.data.generated;
    toast.success(
      generated > 0
        ? `${isEdit ? "Updated" : "Created"} — ${generated} ${generated === 1 ? "entry" : "entries"} posted`
        : isEdit
          ? "Recurring rule updated"
          : "Recurring rule created",
    );

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit recurring rule" : "New recurring rule"}
          </DialogTitle>
          <DialogDescription>
            Rules post themselves on schedule. A start date in the past fills in
            the backlog immediately.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="pb-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormError message={error} />

            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
                  {(["EXPENSE", "INCOME"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => field.onChange(option)}
                      className={cn(
                        "rounded-lg py-2 text-sm font-medium transition-all duration-300",
                        field.value === option
                          ? option === "INCOME"
                            ? "bg-success/20 text-white"
                            : "bg-danger/20 text-white"
                          : "text-muted-foreground hover:text-white",
                      )}
                    >
                      {option === "INCOME" ? "Income" : "Expense"}
                    </button>
                  ))}
                </div>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Amount"
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

              <Field
                label="Category"
                htmlFor="categoryId"
                error={form.formState.errors.categoryId?.message}
              >
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="categoryId">
                        <SelectValue placeholder="Pick one" />
                      </SelectTrigger>
                      <SelectContent>
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
            </div>

            <Field
              label="Description"
              htmlFor="description"
              error={form.formState.errors.description?.message}
            >
              <Input
                id="description"
                placeholder={type === "INCOME" ? "Monthly salary" : "Rent"}
                maxLength={140}
                invalid={Boolean(form.formState.errors.description)}
                {...form.register("description")}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Repeats" htmlFor="frequency">
                <Controller
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {frequencyLabel(option, 1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field
                label="Every"
                htmlFor="interval"
                hint={frequencyLabel(frequency, interval)}
                error={form.formState.errors.interval?.message}
              >
                <Input
                  id="interval"
                  type="number"
                  min="1"
                  max="52"
                  step="1"
                  className="tabular"
                  invalid={Boolean(form.formState.errors.interval)}
                  {...form.register("interval", { valueAsNumber: true })}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Starts"
                htmlFor="startDate"
                error={form.formState.errors.startDate?.message as string | undefined}
              >
                <Input
                  id="startDate"
                  type="date"
                  icon={<CalendarDays />}
                  invalid={Boolean(form.formState.errors.startDate)}
                  {...form.register("startDate")}
                />
              </Field>

              <Field
                label="Ends"
                htmlFor="endDate"
                hint="Optional"
                error={form.formState.errors.endDate?.message as string | undefined}
              >
                <Controller
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <Input
                      id="endDate"
                      type="date"
                      icon={<CalendarDays />}
                      value={typeof field.value === "string" ? field.value : ""}
                      onChange={(event) => field.onChange(event.target.value || null)}
                    />
                  )}
                />
              </Field>
            </div>

            <Field label="Notes" htmlFor="notes">
              <Textarea
                id="notes"
                rows={2}
                maxLength={500}
                placeholder="Optional"
                {...form.register("notes")}
              />
            </Field>

            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3">
                  <div>
                    <p className="text-sm text-white">Active</p>
                    <p className="text-xs text-subtle">
                      Paused rules stop posting until you resume them
                    </p>
                  </div>
                  <Switch
                    checked={Boolean(field.value)}
                    onCheckedChange={field.onChange}
                    aria-label="Rule is active"
                  />
                </div>
              )}
            />

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
                {isEdit ? "Save changes" : "Create rule"}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
