"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransactionFilters } from "@/hooks/use-transaction-filters";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * Builds a compact page list with ellipses, e.g. 1 … 4 5 6 … 20.
 * Always shows the first and last page so the ends stay reachable.
 */
function buildPageList(current: number, total: number): (number | "gap")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages: (number | "gap")[] = [1];

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push("gap");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push("gap");

  pages.push(total);
  return pages;
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
}) {
  const { update, pending } = useTransactionFilters();

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages = React.useMemo(() => buildPageList(page, pageCount), [page, pageCount]);

  function goTo(next: number) {
    const clamped = Math.min(Math.max(1, next), pageCount);
    if (clamped === page) return;
    update({ page: clamped }, { resetPage: false });
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 sm:flex-row",
        pending && "opacity-60",
      )}
    >
      <div className="flex items-center gap-3">
        <p className="tabular text-xs text-muted-foreground">
          {total === 0 ? (
            "No results"
          ) : (
            <>
              Showing <span className="font-medium text-white">{from}</span>–
              <span className="font-medium text-white">{to}</span> of{" "}
              <span className="font-medium text-white">{total}</span>
            </>
          )}
        </p>

        <Select
          value={String(pageSize)}
          onValueChange={(value) => update({ size: Number(value), page: 1 })}
        >
          <SelectTrigger className="h-8 w-[92px] text-xs" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pageCount > 1 ? (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => goTo(1)}
            disabled={page <= 1}
            aria-label="First page"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <div className="flex items-center gap-1 px-1">
            {pages.map((entry, index) =>
              entry === "gap" ? (
                <span key={`gap-${index}`} className="px-1 text-xs text-subtle">
                  …
                </span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  onClick={() => goTo(entry)}
                  aria-current={entry === page ? "page" : undefined}
                  className={cn(
                    "tabular grid size-8 place-items-center rounded-lg text-xs font-medium transition-all duration-300",
                    entry === page
                      ? "bg-brand-gradient text-white shadow-[0_6px_18px_-8px_rgba(124,58,237,0.9)]"
                      : "text-muted-foreground hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  {entry}
                </button>
              ),
            )}
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => goTo(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => goTo(pageCount)}
            disabled={page >= pageCount}
            aria-label="Last page"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
