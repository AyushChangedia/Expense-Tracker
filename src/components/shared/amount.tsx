"use client";

import * as React from "react";

import { formatCurrency } from "@/lib/currency";
import { usePreferences } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@prisma/client";

type AmountProps = {
  value: number;
  type?: TransactionType;
  /** Overrides the signed-in user's currency. Rarely needed. */
  currency?: string;
  locale?: string;
  /** Colour by direction (green income / red expense). */
  colored?: boolean;
  showSign?: boolean;
  compact?: boolean;
  className?: string;
};

/**
 * Renders money with consistent sign, colour, and tabular figures so columns
 * of numbers stay aligned as values change.
 *
 * Currency and locale default to the signed-in user's preferences rather than
 * to USD. Defaulting to a hardcoded currency meant every caller had to
 * remember to pass it, and the ones that forgot silently rendered the wrong
 * symbol — so the default is now the correct value, not a guess.
 */
export function Amount({
  value,
  type,
  currency,
  locale,
  colored = true,
  showSign = true,
  compact = false,
  className,
}: AmountProps) {
  const preferences = usePreferences();

  const isIncome = type === "INCOME";
  const isExpense = type === "EXPENSE";

  const formatted = formatCurrency(Math.abs(value), {
    currency: currency ?? preferences.currency,
    locale: locale ?? preferences.locale,
    compact,
  });
  const sign = showSign && type ? (isIncome ? "+" : "−") : value < 0 ? "−" : "";

  return (
    <span
      className={cn(
        "tabular font-semibold",
        colored && isIncome && "text-success",
        colored && isExpense && "text-danger",
        colored && !type && value < 0 && "text-danger",
        colored && !type && value > 0 && "text-white",
        className,
      )}
    >
      {sign}
      {formatted}
    </span>
  );
}

/** A percentage delta with directional colouring — used on the stat cards. */
export function DeltaBadge({
  value,
  /** For expenses, a rise is bad; set this so the colour matches meaning. */
  invert = false,
  className,
}: {
  value: number | null;
  invert?: boolean;
  className?: string;
}) {
  if (value === null || !Number.isFinite(value)) {
    return <span className={cn("text-xs text-subtle", className)}>No prior data</span>;
  }

  const rounded = Math.round(value * 10) / 10;
  const isUp = rounded > 0;
  const isFlat = Math.abs(rounded) < 0.05;

  const good = invert ? !isUp : isUp;

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 text-xs font-medium",
        isFlat ? "text-subtle" : good ? "text-success" : "text-danger",
        className,
      )}
    >
      {isFlat ? "—" : `${isUp ? "↑" : "↓"} ${Math.abs(rounded).toFixed(1)}%`}
    </span>
  );
}
