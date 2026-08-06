"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { TransactionFilters } from "@/lib/validations";

export type FilterPatch = Partial<{
  q: string;
  type: "ALL" | "INCOME" | "EXPENSE";
  category: string[];
  tag: string[];
  from: string;
  to: string;
  min: string;
  max: string;
  pinned: boolean;
  sort: TransactionFilters["sort"];
  dir: "asc" | "desc";
  page: number;
  size: number;
}>;

/**
 * Keeps the transaction list's filters in the URL.
 *
 * The page is server-rendered from these params, so a filtered view is
 * shareable, survives a refresh, and the back button behaves. Updates run
 * inside a transition so the table dims rather than blanking while the
 * server re-renders.
 */
export function useTransactionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const update = React.useCallback(
    (patch: FilterPatch, options: { resetPage?: boolean } = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      const resetPage = options.resetPage ?? !("page" in patch);

      for (const [key, value] of Object.entries(patch)) {
        if (
          value === undefined ||
          value === null ||
          value === "" ||
          value === false ||
          (Array.isArray(value) && value.length === 0)
        ) {
          params.delete(key);
          continue;
        }

        if (Array.isArray(value)) {
          params.delete(key);
          for (const entry of value) params.append(key, entry);
        } else {
          params.set(key, String(value));
        }
      }

      // Any filter change invalidates the current page number.
      if (resetPage) params.delete("page");

      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const reset = React.useCallback(() => {
    startTransition(() => router.replace(pathname, { scroll: false }));
  }, [pathname, router]);

  const current = React.useMemo(
    () => ({
      q: searchParams.get("q") ?? "",
      type: (searchParams.get("type") ?? "ALL") as "ALL" | "INCOME" | "EXPENSE",
      category: searchParams.getAll("category"),
      tag: searchParams.getAll("tag"),
      from: searchParams.get("from") ?? "",
      to: searchParams.get("to") ?? "",
      min: searchParams.get("min") ?? "",
      max: searchParams.get("max") ?? "",
      pinned: searchParams.get("pinned") === "1",
      sort: (searchParams.get("sort") ?? "date") as TransactionFilters["sort"],
      dir: (searchParams.get("dir") ?? "desc") as "asc" | "desc",
      page: Number(searchParams.get("page") ?? 1),
      size: Number(searchParams.get("size") ?? 10),
    }),
    [searchParams],
  );

  const activeCount = React.useMemo(() => {
    let count = 0;
    if (current.q) count += 1;
    if (current.type !== "ALL") count += 1;
    count += current.category.length;
    count += current.tag.length;
    if (current.from) count += 1;
    if (current.to) count += 1;
    if (current.min) count += 1;
    if (current.max) count += 1;
    if (current.pinned) count += 1;
    return count;
  }, [current]);

  return { current, update, reset, pending, activeCount };
}
