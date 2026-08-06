"use client";

import * as React from "react";
import {
  Check,
  Filter,
  Pin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CategoryIcon } from "@/components/shared/category-chip";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import { useTransactionFilters } from "@/hooks/use-transaction-filters";
import { currencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "INCOME", label: "Income" },
  { value: "EXPENSE", label: "Expense" },
] as const;

export function TransactionFiltersBar() {
  const { categories, tags, currency } = usePreferences();
  const { current, update, reset, pending, activeCount } = useTransactionFilters();

  // The input is uncontrolled-ish: local state for responsiveness, debounced
  // push to the URL so the server is not queried on every keystroke.
  const [query, setQuery] = React.useState(current.q);
  const pushQuery = useDebouncedCallback((value: string) => {
    update({ q: value });
  }, 350);

  React.useEffect(() => {
    setQuery(current.q);
  }, [current.q]);

  function toggleCategory(id: string) {
    const next = current.category.includes(id)
      ? current.category.filter((entry) => entry !== id)
      : [...current.category, id];
    update({ category: next });
  }

  function toggleTag(slug: string) {
    const next = current.tag.includes(slug)
      ? current.tag.filter((entry) => entry !== slug)
      : [...current.tag, slug];
    update({ tag: next });
  }

  const symbol = currencySymbol(currency);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              pushQuery(event.target.value);
            }}
            placeholder="Search descriptions, notes, categories, tags…"
            icon={<Search />}
            className={cn("pr-9", pending && "opacity-70")}
            aria-label="Search transactions"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                update({ q: "" });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-subtle transition-colors hover:text-white"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        {/* Income / expense segmented control */}
        <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
          {TYPE_OPTIONS.map((option) => {
            const active = current.type === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => update({ type: option.value })}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-300",
                  active ? "text-white" : "text-muted-foreground hover:text-white",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="filter-type-pill"
                    className="absolute inset-0 -z-10 rounded-lg bg-brand-gradient shadow-[0_6px_18px_-8px_rgba(124,58,237,0.9)]"
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  />
                ) : null}
                {option.label}
              </button>
            );
          })}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" className="shrink-0">
              <SlidersHorizontal className="size-4" />
              Filters
              {activeCount > 0 ? (
                <Badge variant="default" className="ml-0.5 px-1.5 py-0">
                  {activeCount}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <p className="text-sm font-semibold text-white">Refine results</p>
              {activeCount > 0 ? (
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1 text-xs text-primary-300 transition-colors hover:text-primary-200"
                >
                  <RotateCcw className="size-3" />
                  Reset
                </button>
              ) : null}
            </div>

            <div className="max-h-[60vh] space-y-5 overflow-y-auto p-4">
              {/* Date range */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                  Date range
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={current.from}
                    onChange={(event) => update({ from: event.target.value })}
                    aria-label="From date"
                    className="h-9 text-xs"
                  />
                  <Input
                    type="date"
                    value={current.to}
                    onChange={(event) => update({ to: event.target.value })}
                    aria-label="To date"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Amount range */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                  Amount
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Min"
                    value={current.min}
                    onChange={(event) => update({ min: event.target.value })}
                    aria-label="Minimum amount"
                    className="h-9 text-xs"
                    icon={<span className="text-xs">{symbol}</span>}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Max"
                    value={current.max}
                    onChange={(event) => update({ max: event.target.value })}
                    aria-label="Maximum amount"
                    className="h-9 text-xs"
                    icon={<span className="text-xs">{symbol}</span>}
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                  Categories
                </p>
                <div className="max-h-48 space-y-0.5 overflow-y-auto pr-1">
                  {categories.map((category) => {
                    const checked = current.category.includes(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => toggleCategory(category.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                          checked
                            ? "bg-primary/10 text-white"
                            : "text-muted-foreground hover:bg-white/[0.04] hover:text-white",
                        )}
                      >
                        <CategoryIcon
                          name={category.name}
                          icon={category.icon}
                          gradientFrom={category.gradientFrom}
                          gradientTo={category.gradientTo}
                          size="sm"
                          className="size-6 rounded-md"
                        />
                        <span className="flex-1 truncate">{category.name}</span>
                        {checked ? (
                          <Check className="size-3.5 shrink-0 text-primary-300" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tags */}
              {tags.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => {
                      const checked = current.tag.includes(tag.slug);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.slug)}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                            checked
                              ? "border-primary/40 bg-primary/15 text-primary-200"
                              : "border-white/[0.08] text-muted-foreground hover:border-white/[0.16] hover:text-white",
                          )}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Pinned only */}
              <button
                type="button"
                onClick={() => update({ pinned: !current.pinned })}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                  current.pinned
                    ? "border-primary/30 bg-primary/10 text-white"
                    : "border-white/[0.08] text-muted-foreground hover:text-white",
                )}
              >
                <Pin className="size-4" />
                <span className="flex-1 text-left">Pinned only</span>
                {current.pinned ? <Check className="size-3.5 text-primary-300" /> : null}
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active filter chips */}
      <AnimatePresence>
        {activeCount > 0 ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center gap-1.5 overflow-hidden"
          >
            <span className="flex items-center gap-1 text-[11px] text-subtle">
              <Filter className="size-3" />
              Active:
            </span>

            {current.type !== "ALL" ? (
              <FilterChip
                label={current.type === "INCOME" ? "Income" : "Expense"}
                onRemove={() => update({ type: "ALL" })}
              />
            ) : null}

            {current.category.map((id) => {
              const category = categories.find((entry) => entry.id === id);
              if (!category) return null;
              return (
                <FilterChip
                  key={id}
                  label={category.name}
                  onRemove={() => toggleCategory(id)}
                />
              );
            })}

            {current.tag.map((slug) => {
              const tag = tags.find((entry) => entry.slug === slug);
              return (
                <FilterChip
                  key={slug}
                  label={`#${tag?.name ?? slug}`}
                  onRemove={() => toggleTag(slug)}
                />
              );
            })}

            {current.from ? (
              <FilterChip
                label={`From ${current.from}`}
                onRemove={() => update({ from: "" })}
              />
            ) : null}
            {current.to ? (
              <FilterChip label={`To ${current.to}`} onRemove={() => update({ to: "" })} />
            ) : null}
            {current.min ? (
              <FilterChip
                label={`Min ${symbol}${current.min}`}
                onRemove={() => update({ min: "" })}
              />
            ) : null}
            {current.max ? (
              <FilterChip
                label={`Max ${symbol}${current.max}`}
                onRemove={() => update({ max: "" })}
              />
            ) : null}
            {current.pinned ? (
              <FilterChip label="Pinned" onRemove={() => update({ pinned: false })} />
            ) : null}

            <button
              type="button"
              onClick={reset}
              className="ml-1 text-[11px] text-primary-300 transition-colors hover:text-primary-200"
            >
              Clear all
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] py-0.5 pl-2.5 pr-1 text-[11px] text-muted-foreground"
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 transition-colors hover:bg-white/[0.10] hover:text-white"
        aria-label={`Remove filter ${label}`}
      >
        <X className="size-3" />
      </button>
    </motion.span>
  );
}
