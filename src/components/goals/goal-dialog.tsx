"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormError } from "@/components/auth/auth-card";
import { usePreferences } from "@/components/providers/preferences-provider";
import { currencySymbol } from "@/lib/currency";
import { GRADIENT_PRESETS, ICON_NAMES, getCategoryIcon } from "@/lib/categories";
import { goalSchema } from "@/lib/validations";
import { cn } from "@/lib/utils";
import { createGoal, updateGoal } from "@/server/actions/goals";
import type { GoalDTO } from "@/types";

const formSchema = goalSchema;
type FormValues = z.input<typeof formSchema>;

export function GoalDialog({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: GoalDTO | null;
}) {
  const router = useRouter();
  const { currency } = usePreferences();

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEdit = Boolean(goal);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      targetAmount: "" as unknown as number,
      currentAmount: 0,
      deadline: null,
      icon: "Target",
      gradientFrom: "#7C3AED",
      gradientTo: "#38BDF8",
      notes: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      name: goal?.name ?? "",
      targetAmount: goal?.targetAmount ?? ("" as unknown as number),
      currentAmount: goal?.currentAmount ?? 0,
      deadline: goal?.deadline ? goal.deadline.slice(0, 10) : null,
      icon: goal?.icon ?? "Target",
      gradientFrom: goal?.gradientFrom ?? "#7C3AED",
      gradientTo: goal?.gradientTo ?? "#38BDF8",
      notes: goal?.notes ?? "",
    });
    setError(null);
  }, [open, goal, form]);

  const selectedIcon = form.watch("icon");
  const gradientFrom = form.watch("gradientFrom");
  const gradientTo = form.watch("gradientTo");

  async function onSubmit(values: FormValues) {
    setPending(true);
    setError(null);

    const payload = {
      name: String(values.name).trim(),
      targetAmount: Number(values.targetAmount),
      currentAmount: Number(values.currentAmount ?? 0),
      // An empty date input yields "", which must become null, not an epoch.
      deadline: values.deadline ? values.deadline : null,
      icon: values.icon ?? "Target",
      gradientFrom: values.gradientFrom ?? "#7C3AED",
      gradientTo: values.gradientTo ?? "#38BDF8",
      notes: String(values.notes ?? ""),
    };

    const result = isEdit
      ? await updateGoal({ ...payload, id: goal!.id })
      : await createGoal(payload);

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success(isEdit ? "Goal updated" : "Goal created");
    onOpenChange(false);
    router.refresh();
  }

  const PreviewIcon = getCategoryIcon(selectedIcon);

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit goal" : "New savings goal"}</DialogTitle>
          <DialogDescription>
            Give it a target and a deadline, and we work out what you need to
            put aside each month.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="pb-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormError message={error} />

            {/* Live preview of icon + gradient */}
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
              <span
                className="grid size-12 shrink-0 place-items-center rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
                  boxShadow: `0 8px 24px -10px ${gradientFrom}`,
                }}
              >
                <PreviewIcon className="size-5 text-white" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {form.watch("name") || "Your goal"}
                </p>
                <p className="text-xs text-subtle">
                  Preview of how it appears on the goals board
                </p>
              </div>
            </div>

            <Field label="Name" htmlFor="name" error={form.formState.errors.name?.message}>
              <Input
                id="name"
                placeholder="Emergency fund"
                autoFocus
                maxLength={60}
                invalid={Boolean(form.formState.errors.name)}
                {...form.register("name")}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Target amount"
                htmlFor="targetAmount"
                error={form.formState.errors.targetAmount?.message}
              >
                <Input
                  id="targetAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="tabular"
                  icon={
                    <span className="text-sm font-medium">
                      {currencySymbol(currency)}
                    </span>
                  }
                  invalid={Boolean(form.formState.errors.targetAmount)}
                  {...form.register("targetAmount", { valueAsNumber: true })}
                />
              </Field>

              <Field
                label="Already saved"
                htmlFor="currentAmount"
                error={form.formState.errors.currentAmount?.message}
              >
                <Input
                  id="currentAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="tabular"
                  icon={
                    <span className="text-sm font-medium">
                      {currencySymbol(currency)}
                    </span>
                  }
                  invalid={Boolean(form.formState.errors.currentAmount)}
                  {...form.register("currentAmount", { valueAsNumber: true })}
                />
              </Field>
            </div>

            <Field
              label="Deadline"
              htmlFor="deadline"
              hint="Optional — set one to see the monthly contribution needed."
              error={form.formState.errors.deadline?.message as string | undefined}
            >
              <Controller
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <Input
                    id="deadline"
                    type="date"
                    value={typeof field.value === "string" ? field.value : ""}
                    onChange={(event) => field.onChange(event.target.value || null)}
                  />
                )}
              />
            </Field>

            {/* Icon picker */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Icon
              </p>
              <Controller
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <div className="hide-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                    {ICON_NAMES.map((name) => {
                      const Icon = getCategoryIcon(name);
                      const active = field.value === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => field.onChange(name)}
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-lg border transition-all duration-200",
                            active
                              ? "border-primary/50 bg-primary/15 text-primary-200"
                              : "border-white/[0.08] text-subtle hover:border-white/[0.18] hover:text-white",
                          )}
                          aria-label={name}
                          aria-pressed={active}
                        >
                          <Icon className="size-4" strokeWidth={2} />
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </div>

            {/* Gradient picker */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Colour
              </p>
              <div className="flex flex-wrap gap-1.5">
                {GRADIENT_PRESETS.map((preset) => {
                  const active =
                    gradientFrom === preset.from && gradientTo === preset.to;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        form.setValue("gradientFrom", preset.from, {
                          shouldDirty: true,
                        });
                        form.setValue("gradientTo", preset.to, { shouldDirty: true });
                      }}
                      className={cn(
                        "size-8 rounded-lg border-2 transition-all duration-200",
                        active
                          ? "border-white scale-110"
                          : "border-transparent hover:scale-105",
                      )}
                      style={{
                        background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                      }}
                      aria-label={preset.label}
                      aria-pressed={active}
                      title={preset.label}
                    />
                  );
                })}
              </div>
            </div>

            <Field
              label="Notes"
              htmlFor="notes"
              error={form.formState.errors.notes?.message}
            >
              <Textarea
                id="notes"
                rows={2}
                maxLength={300}
                placeholder="What is this for?"
                {...form.register("notes")}
              />
            </Field>

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
                {isEdit ? "Save changes" : "Create goal"}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
