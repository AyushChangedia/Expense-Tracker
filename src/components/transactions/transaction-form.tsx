"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Pin, Tag as TagIcon, X } from "lucide-react";
import { motion } from "framer-motion";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { transactionSchema } from "@/lib/validations";
import { cn, slugify } from "@/lib/utils";
import type { TransactionDTO } from "@/types";

const formSchema = transactionSchema;
type FormValues = z.input<typeof formSchema>;

export type TransactionFormValues = {
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  categoryId: string;
  date: string;
  notes: string;
  tags: string[];
  isPinned: boolean;
};

type TransactionFormProps = {
  /** Pre-fills the form when editing or duplicating. */
  initial?: Partial<TransactionFormValues> | TransactionDTO;
  onSubmit: (values: TransactionFormValues) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
  pending?: boolean;
  error?: string | null;
  fieldErrors?: Record<string, string[]>;
  compact?: boolean;
};

function toFormValues(
  initial: TransactionFormProps["initial"],
): Partial<TransactionFormValues> {
  if (!initial) return {};

  // A full DTO carries nested category/tag objects; flatten them.
  if ("category" in initial && initial.category) {
    const dto = initial as TransactionDTO;
    return {
      type: dto.type,
      amount: dto.amount,
      description: dto.description,
      categoryId: dto.category.id,
      date: dto.date.slice(0, 10),
      notes: dto.notes ?? "",
      tags: dto.tags.map((tag) => tag.name),
      isPinned: dto.isPinned,
    };
  }

  return initial as Partial<TransactionFormValues>;
}

export function TransactionForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Save transaction",
  pending = false,
  error,
  fieldErrors,
  compact = false,
}: TransactionFormProps) {
  const { categories, currency, tags: allTags } = usePreferences();
  const defaults = React.useMemo(() => toFormValues(initial), [initial]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: defaults.type ?? "EXPENSE",
      amount: defaults.amount ?? ("" as unknown as number),
      description: defaults.description ?? "",
      categoryId: defaults.categoryId ?? "",
      date: defaults.date ?? new Date().toISOString().slice(0, 10),
      notes: defaults.notes ?? "",
      tags: defaults.tags ?? [],
      isPinned: defaults.isPinned ?? false,
    },
  });

  const type = form.watch("type");
  const watchedTags = form.watch("tags");
  // Memoised so the `?? []` fallback does not produce a new array identity on
  // every render and invalidate the suggestion memo below.
  const selectedTags = React.useMemo(
    () => (watchedTags ?? []) as string[],
    [watchedTags],
  );

  // Categories are scoped to the side of the ledger being recorded.
  const availableCategories = React.useMemo(
    () =>
      categories.filter(
        (category) => category.kind === "BOTH" || category.kind === type,
      ),
    [categories, type],
  );

  // Switching income <-> expense can strand a category that no longer applies.
  React.useEffect(() => {
    const current = form.getValues("categoryId");
    if (!current) return;
    if (!availableCategories.some((category) => category.id === current)) {
      form.setValue("categoryId", "", { shouldValidate: false });
    }
  }, [availableCategories, form]);

  // Surface server-side field errors on the matching inputs.
  React.useEffect(() => {
    if (!fieldErrors) return;
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (messages?.[0]) {
        form.setError(field as keyof FormValues, { message: messages[0] });
      }
    }
  }, [fieldErrors, form]);

  const [tagInput, setTagInput] = React.useState("");

  function addTag(raw: string) {
    const name = raw.trim();
    if (!name) return;

    const slug = slugify(name);
    if (!slug) return;

    const existing = selectedTags.map((tag) => slugify(tag));
    if (existing.includes(slug) || selectedTags.length >= 10) {
      setTagInput("");
      return;
    }

    form.setValue("tags", [...selectedTags, name], { shouldDirty: true });
    setTagInput("");
  }

  function removeTag(name: string) {
    form.setValue(
      "tags",
      selectedTags.filter((tag) => tag !== name),
      { shouldDirty: true },
    );
  }

  const tagSuggestions = React.useMemo(() => {
    const chosen = new Set(selectedTags.map((tag) => slugify(tag)));
    return allTags.filter((tag) => !chosen.has(tag.slug)).slice(0, 6);
  }, [allTags, selectedTags]);

  async function handleSubmit(values: FormValues) {
    await onSubmit({
      type: values.type,
      amount: Number(values.amount),
      description: String(values.description).trim(),
      categoryId: values.categoryId,
      date: String(values.date),
      notes: String(values.notes ?? ""),
      tags: (values.tags ?? []) as string[],
      isPinned: Boolean(values.isPinned),
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className={cn("space-y-4", compact && "space-y-3.5")}
      noValidate
    >
      <FormError message={error} />

      {/* Income / expense toggle */}
      <Controller
        control={form.control}
        name="type"
        render={({ field }) => (
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
            {(["EXPENSE", "INCOME"] as const).map((option) => {
              const active = field.value === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => field.onChange(option)}
                  className={cn(
                    "relative rounded-lg py-2 text-sm font-medium transition-colors duration-300",
                    active ? "text-white" : "text-muted-foreground hover:text-white",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="transaction-type-pill"
                      className={cn(
                        "absolute inset-0 -z-10 rounded-lg",
                        option === "INCOME"
                          ? "bg-success/20 shadow-[0_0_20px_-6px_rgba(34,197,94,0.8)]"
                          : "bg-danger/20 shadow-[0_0_20px_-6px_rgba(239,68,68,0.8)]",
                      )}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    />
                  ) : null}
                  {option === "INCOME" ? "Income" : "Expense"}
                </button>
              );
            })}
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
            className="tabular text-base font-semibold"
            icon={
              <span className="text-sm font-medium">{currencySymbol(currency)}</span>
            }
            invalid={Boolean(form.formState.errors.amount)}
            {...form.register("amount", { valueAsNumber: true })}
          />
        </Field>

        <Field label="Date" htmlFor="date" error={form.formState.errors.date?.message}>
          <Input
            id="date"
            type="date"
            max="2100-12-31"
            icon={<CalendarDays />}
            invalid={Boolean(form.formState.errors.date)}
            {...form.register("date")}
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
          placeholder={type === "INCOME" ? "Monthly salary" : "Lunch at Nori"}
          maxLength={140}
          invalid={Boolean(form.formState.errors.description)}
          {...form.register("description")}
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
                <SelectValue placeholder="Pick a category" />
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

      {/* Tags */}
      <div className="space-y-1.5">
        <label
          htmlFor="tag-input"
          className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Tags
          <span className="ml-1.5 normal-case tracking-normal text-subtle">
            optional
          </span>
        </label>

        {selectedTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pb-1">
            {selectedTags.map((tag) => (
              <motion.span
                key={tag}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs text-primary-200"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="size-3" />
                </button>
              </motion.span>
            ))}
          </div>
        ) : null}

        <Input
          id="tag-input"
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag(tagInput);
            } else if (event.key === "Backspace" && !tagInput && selectedTags.length) {
              removeTag(selectedTags[selectedTags.length - 1]);
            }
          }}
          onBlur={() => addTag(tagInput)}
          placeholder="Type a tag and press Enter"
          maxLength={30}
          icon={<TagIcon />}
          disabled={selectedTags.length >= 10}
        />

        {tagSuggestions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tagSuggestions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => addTag(tag.name)}
                className="rounded-full border border-white/[0.08] px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-white"
              >
                + {tag.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!compact ? (
        <Field
          label="Notes"
          htmlFor="notes"
          error={form.formState.errors.notes?.message}
        >
          <Textarea
            id="notes"
            placeholder="Anything worth remembering about this one"
            maxLength={500}
            rows={2}
            {...form.register("notes")}
          />
        </Field>
      ) : null}

      <Controller
        control={form.control}
        name="isPinned"
        render={({ field }) => (
          <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <Pin className="size-4 text-subtle" />
              <div>
                <p className="text-sm text-white">Pin this transaction</p>
                <p className="text-xs text-subtle">Keeps it visible on the dashboard</p>
              </div>
            </div>
            <Switch
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              aria-label="Pin this transaction"
            />
          </div>
        )}
      />

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
