"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Download,
  LogOut,
  Minus,
  Plus,
  Settings,
  Sparkles,
  Tag as TagIcon,
  Target,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { CategoryIcon } from "@/components/shared/category-chip";
import { Amount } from "@/components/shared/amount";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import { useDebounce } from "@/hooks/use-debounce";
import { useIsMac, useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { NAV_ITEMS } from "@/lib/navigation";
import { relativeDay } from "@/lib/dates";
import { signOutUser } from "@/server/actions/auth";
import type { TransactionDTO } from "@/types";

type SearchResults = {
  transactions: TransactionDTO[];
  categories: {
    id: string;
    name: string;
    slug: string;
    icon: string;
    gradientFrom: string;
    gradientTo: string;
  }[];
  tags: { id: string; name: string; slug: string; color: string }[];
  goals: { id: string; name: string; targetAmount: number; currentAmount: number }[];
};

const EMPTY: SearchResults = {
  transactions: [],
  categories: [],
  tags: [],
  goals: [],
};

/**
 * ⌘K palette: global search plus every navigation and creation action.
 *
 * Search hits `/api/search` rather than a server action so results can stream
 * in as the user types without a full server round-trip per keystroke.
 */
export function CommandPalette() {
  const router = useRouter();
  const isMac = useIsMac();
  const { openCreate } = useTransactionDialog();
  const { dateFormat } = usePreferences();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResults>(EMPTY);
  const [searching, setSearching] = React.useState(false);

  const debouncedQuery = useDebounce(query, 200);

  useKeyboardShortcut("k", () => setOpen((current) => !current), { meta: true });
  useKeyboardShortcut("/", () => setOpen(true));

  // Fetch results whenever the debounced query changes.
  React.useEffect(() => {
    const trimmed = debouncedQuery.trim();

    if (trimmed.length < 2) {
      setResults(EMPTY);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);

    fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : EMPTY))
      .then((data: SearchResults) => {
        setResults({
          transactions: data.transactions ?? [],
          categories: data.categories ?? [],
          tags: data.tags ?? [],
          goals: data.goals ?? [],
        });
      })
      .catch((error) => {
        // Aborts are expected as the user keeps typing.
        if (error?.name !== "AbortError") setResults(EMPTY);
      })
      .finally(() => setSearching(false));

    return () => controller.abort();
  }, [debouncedQuery]);

  // Reset when the dialog closes so the next open starts clean.
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(EMPTY);
    }
  }, [open]);

  const run = React.useCallback((action: () => void) => {
    setOpen(false);
    // Let the close animation start before navigating.
    requestAnimationFrame(action);
  }, []);

  const hasResults =
    results.transactions.length > 0 ||
    results.categories.length > 0 ||
    results.tags.length > 0 ||
    results.goals.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search transactions, or jump to a page…"
      />

      <CommandList>
        <CommandEmpty>
          {searching
            ? "Searching…"
            : query.trim().length >= 2
              ? `Nothing matches "${query.trim()}"`
              : "Type at least two characters to search."}
        </CommandEmpty>

        {/* --- Actions ------------------------------------------------- */}
        <CommandGroup heading="Actions">
          <CommandItem
            value="add expense new transaction create"
            onSelect={() => run(() => openCreate({ type: "EXPENSE" }))}
          >
            <Minus className="text-danger" />
            Add expense
            <CommandShortcut>{isMac ? "⌘" : "Ctrl"} E</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="add income new transaction create earning"
            onSelect={() => run(() => openCreate({ type: "INCOME" }))}
          >
            <Plus className="text-success" />
            Add income
            <CommandShortcut>{isMac ? "⌘" : "Ctrl"} I</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="export download data csv excel json"
            onSelect={() => run(() => router.push("/settings?tab=data"))}
          >
            <Download />
            Export your data
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* --- Navigation ---------------------------------------------- */}
        <CommandGroup heading="Go to">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.href}
              value={`${item.label} ${item.description}`}
              onSelect={() => run(() => router.push(item.href))}
            >
              <item.icon />
              <span className="flex-1">{item.label}</span>
              {item.shortcut ? (
                <CommandShortcut>G {item.shortcut.toUpperCase()}</CommandShortcut>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>

        {/* --- Search results ------------------------------------------ */}
        {results.transactions.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Transactions">
              {results.transactions.map((transaction) => (
                <CommandItem
                  key={transaction.id}
                  value={`tx-${transaction.id}-${transaction.description}`}
                  onSelect={() =>
                    run(() =>
                      router.push(
                        `/transactions?q=${encodeURIComponent(transaction.description)}`,
                      ),
                    )
                  }
                >
                  <CategoryIcon
                    name={transaction.category.name}
                    icon={transaction.category.icon}
                    gradientFrom={transaction.category.gradientFrom}
                    gradientTo={transaction.category.gradientTo}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{transaction.description}</span>
                    <span className="block text-[11px] text-subtle">
                      {transaction.category.name} ·{" "}
                      {relativeDay(transaction.date, dateFormat)}
                    </span>
                  </span>
                  <Amount
                    value={transaction.amount}
                    type={transaction.type}
                    className="text-xs"
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {results.categories.length > 0 ? (
          <CommandGroup heading="Categories">
            {results.categories.map((category) => (
              <CommandItem
                key={category.id}
                value={`cat-${category.id}-${category.name}`}
                onSelect={() =>
                  run(() => router.push(`/transactions?category=${category.id}`))
                }
              >
                <CategoryIcon
                  name={category.name}
                  icon={category.icon}
                  gradientFrom={category.gradientFrom}
                  gradientTo={category.gradientTo}
                  size="sm"
                />
                <span className="flex-1">{category.name}</span>
                <ArrowRight className="text-subtle" />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {results.tags.length > 0 ? (
          <CommandGroup heading="Tags">
            {results.tags.map((tag) => (
              <CommandItem
                key={tag.id}
                value={`tag-${tag.id}-${tag.name}`}
                onSelect={() => run(() => router.push(`/transactions?tag=${tag.slug}`))}
              >
                <TagIcon style={{ color: tag.color }} />
                <span className="flex-1">{tag.name}</span>
                <ArrowRight className="text-subtle" />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {results.goals.length > 0 ? (
          <CommandGroup heading="Goals">
            {results.goals.map((goal) => (
              <CommandItem
                key={goal.id}
                value={`goal-${goal.id}-${goal.name}`}
                onSelect={() => run(() => router.push("/goals"))}
              >
                <Target />
                <span className="flex-1">{goal.name}</span>
                <span className="tabular text-xs text-subtle">
                  {goal.targetAmount > 0
                    ? `${Math.round((goal.currentAmount / goal.targetAmount) * 100)}%`
                    : "0%"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {!hasResults && query.trim().length >= 2 && !searching ? null : null}

        <CommandSeparator />

        <CommandGroup heading="Account">
          <CommandItem
            value="settings preferences currency profile"
            onSelect={() => run(() => router.push("/settings"))}
          >
            <Settings />
            Settings
          </CommandItem>
          <CommandItem
            value="sign out log out"
            onSelect={() => run(() => void signOutUser())}
          >
            <LogOut />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>

      <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5 text-[10px] text-subtle">
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-3" />
          Search across everything
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-white/[0.10] bg-white/[0.05] px-1 py-0.5 font-mono">
              ↑↓
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-white/[0.10] bg-white/[0.05] px-1 py-0.5 font-mono">
              ↵
            </kbd>
            select
          </span>
        </span>
      </div>
    </CommandDialog>
  );
}

/**
 * App-wide keyboard shortcuts that are not tied to the palette itself.
 * Rendered once in the dashboard layout.
 */
export function GlobalShortcuts() {
  const router = useRouter();
  const { openCreate } = useTransactionDialog();
  const sequence = React.useRef<{ key: string; at: number } | null>(null);

  useKeyboardShortcut("e", () => openCreate({ type: "EXPENSE" }), { meta: true });
  useKeyboardShortcut("i", () => openCreate({ type: "INCOME" }), { meta: true });

  // Vim-style "g then <key>" jumps.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const now = Date.now();

      if (sequence.current && now - sequence.current.at < 1200) {
        const destination = NAV_ITEMS.find((item) => item.shortcut === key);
        sequence.current = null;
        if (destination) {
          event.preventDefault();
          router.push(destination.href);
        }
        return;
      }

      if (key === "g") {
        sequence.current = { key, at: now };
      } else {
        sequence.current = null;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
