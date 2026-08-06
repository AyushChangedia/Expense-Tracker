"use client";

import * as React from "react";

import { formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/dates";
import type { CategoryDTO, TagDTO, UserPreferences } from "@/types";

type PreferencesContextValue = UserPreferences & {
  categories: CategoryDTO[];
  tags: TagDTO[];
  /** Formats an amount using the signed-in user's currency and locale. */
  formatMoney: (
    value: number,
    options?: { compact?: boolean; signed?: boolean },
  ) => string;
  /** Formats a date using the user's chosen pattern. */
  formatDay: (value: string | Date) => string;
};

const PreferencesContext = React.createContext<PreferencesContextValue | null>(null);

/**
 * Makes the user's currency, date format, categories, and tags available to
 * every client component without prop-drilling through the page tree.
 *
 * The values come from the server on each render of the dashboard layout, so
 * they stay in sync with the database after a settings change.
 */
export function PreferencesProvider({
  preferences,
  categories,
  tags,
  children,
}: {
  preferences: UserPreferences;
  categories: CategoryDTO[];
  tags: TagDTO[];
  children: React.ReactNode;
}) {
  const value = React.useMemo<PreferencesContextValue>(() => {
    const { currency, locale, dateFormat, weekStart } = preferences;

    return {
      currency,
      locale,
      dateFormat,
      weekStart,
      categories,
      tags,
      formatMoney: (amount, options = {}) =>
        formatCurrency(amount, { currency, locale, ...options }),
      formatDay: (date) => formatDate(date, dateFormat),
    };
  }, [preferences, categories, tags]);

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const context = React.useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used inside a PreferencesProvider");
  }
  return context;
}

/** Convenience: only the expense/income categories relevant to a form. */
export function useCategoriesFor(type: "INCOME" | "EXPENSE"): CategoryDTO[] {
  const { categories } = usePreferences();
  return React.useMemo(
    () =>
      categories.filter(
        (category) => category.kind === "BOTH" || category.kind === type,
      ),
    [categories, type],
  );
}
