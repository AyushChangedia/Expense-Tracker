"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CornerDownLeft, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryIcon } from "@/components/shared/category-chip";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import { useDebounce } from "@/hooks/use-debounce";
import { NL_EXAMPLES } from "@/lib/nlp";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  createTransactionFromText,
  parseTransactionText,
} from "@/server/actions/transactions";
import type { ParsedTransactionDraft } from "@/types";

/**
 * Natural-language quick add.
 *
 * Parsing runs on the server as the user types (debounced) so the preview
 * shows exactly what will be created — no surprises when they press Enter.
 */
export function QuickAdd({ className }: { className?: string }) {
  const router = useRouter();
  const { categories, formatMoney, dateFormat } = usePreferences();
  const { openCreate } = useTransactionDialog();

  const [text, setText] = React.useState("");
  const [draft, setDraft] = React.useState<ParsedTransactionDraft | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [exampleIndex, setExampleIndex] = React.useState(0);

  const debouncedText = useDebounce(text, 350);

  // Rotate the placeholder while the field is empty.
  React.useEffect(() => {
    if (text) return;
    const timer = setInterval(
      () => setExampleIndex((index) => (index + 1) % NL_EXAMPLES.length),
      3800,
    );
    return () => clearInterval(timer);
  }, [text]);

  React.useEffect(() => {
    const trimmed = debouncedText.trim();

    if (trimmed.length < 3) {
      setDraft(null);
      return;
    }

    let cancelled = false;
    setParsing(true);

    parseTransactionText({ text: trimmed })
      .then((result) => {
        if (cancelled) return;
        setDraft(result.ok ? result.data : null);
      })
      .finally(() => {
        if (!cancelled) setParsing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedText]);

  const category = React.useMemo(
    () => categories.find((item) => item.id === draft?.categoryId) ?? null,
    [categories, draft],
  );

  const canSave = Boolean(draft && draft.amount !== null && draft.categoryId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmed = text.trim();
    if (trimmed.length < 3) return;

    setSaving(true);
    const result = await createTransactionFromText({ text: trimmed });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error, {
        action: {
          label: "Use the form",
          // Hand off whatever was parsed so nothing typed is lost.
          onClick: () =>
            openCreate({
              type: draft?.type ?? "EXPENSE",
              amount: draft?.amount ?? undefined,
              description: draft?.description ?? trimmed,
              categoryId: draft?.categoryId ?? undefined,
              date: draft?.date,
              tags: draft?.tags ?? [],
            }),
        },
      });
      return;
    }

    toast.success(`Added "${result.data.description}"`);
    setText("");
    setDraft(null);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-3", className)}>
      <div className="relative">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={NL_EXAMPLES[exampleIndex]}
          maxLength={200}
          className="h-12 pl-11 pr-28 text-sm"
          icon={<Wand2 className="text-primary-300" />}
          aria-label="Describe a transaction in plain English"
        />

        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {parsing ? (
            <span className="text-[10px] text-subtle">parsing…</span>
          ) : null}
          <Button
            type="submit"
            size="sm"
            disabled={!canSave || saving}
            loading={saving}
            className="h-9"
          >
            Add
            <CornerDownLeft className="size-3.5" />
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {draft && text.trim().length >= 3 ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
              <Sparkles className="size-3.5 shrink-0 text-primary-300" />

              {draft.amount !== null ? (
                <span
                  className={cn(
                    "tabular rounded-full px-2 py-0.5 text-xs font-semibold",
                    draft.type === "INCOME"
                      ? "bg-success/15 text-success"
                      : "bg-danger/15 text-danger",
                  )}
                >
                  {draft.type === "INCOME" ? "+" : "−"}
                  {formatMoney(draft.amount)}
                </span>
              ) : (
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">
                  no amount found
                </span>
              )}

              {category ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CategoryIcon
                    name={category.name}
                    icon={category.icon}
                    gradientFrom={category.gradientFrom}
                    gradientTo={category.gradientTo}
                    size="sm"
                    className="size-5 rounded-md"
                  />
                  {category.name}
                </span>
              ) : null}

              <span className="text-xs text-muted-foreground">
                {draft.description}
              </span>

              <span className="text-xs text-subtle">
                · {formatDate(draft.date, dateFormat)}
              </span>

              {draft.tags.length > 0 ? (
                <span className="flex gap-1">
                  {draft.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-primary/25 bg-primary/10 px-1.5 text-[10px] text-primary-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </span>
              ) : null}

              <button
                type="button"
                onClick={() =>
                  openCreate({
                    type: draft.type,
                    amount: draft.amount ?? undefined,
                    description: draft.description,
                    categoryId: draft.categoryId ?? undefined,
                    date: draft.date,
                    tags: draft.tags,
                  })
                }
                className="ml-auto shrink-0 text-[11px] text-primary-300 transition-colors hover:text-primary-200"
              >
                Edit details
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </form>
  );
}
