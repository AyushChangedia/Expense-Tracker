import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { QuickAddButtons } from "@/components/dashboard/quick-add-buttons";
import { TransactionFiltersBar } from "@/components/transactions/transaction-filters";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { Pagination } from "@/components/transactions/pagination";
import { TransactionTotals } from "@/components/transactions/transaction-totals";
import { PageTransition } from "@/components/shared/reveal";
import { SkeletonList, Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import { runDueRecurring } from "@/lib/recurring";
import { getTransactionPage } from "@/server/queries/transactions";
import { transactionFilterSchema } from "@/lib/validations";

export const metadata: Metadata = {
  title: "Transactions",
  description: "Search, filter, and manage every transaction.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function TransactionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <PageTransition className="space-y-5">
      <PageHeader
        title="Transactions"
        description="Every entry, searchable and sortable. Select rows for bulk actions."
        actions={<QuickAddButtons />}
      />

      <Suspense fallback={<Skeleton className="h-10 w-full rounded-xl" />}>
        <TransactionFiltersBar />
      </Suspense>

      <Suspense fallback={<TransactionsLoading />}>
        <TransactionsContent searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

/** Reads one value out of a param that may arrive as a repeated key. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

async function TransactionsContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;

  // Post anything the recurring rules owe before listing.
  await runDueRecurring(user.id);

  const minAmount = Number(first(params.min));
  const maxAmount = Number(first(params.max));

  // Zod normalises and defaults everything, so a hand-edited URL cannot break
  // the query — bad values simply fall back.
  const filters = transactionFilterSchema.parse({
    query: first(params.q),
    type: first(params.type) ?? "ALL",
    categoryIds: many(params.category),
    tags: many(params.tag),
    from: first(params.from),
    to: first(params.to),
    minAmount: Number.isFinite(minAmount) && first(params.min) ? minAmount : undefined,
    maxAmount: Number.isFinite(maxAmount) && first(params.max) ? maxAmount : undefined,
    pinnedOnly: first(params.pinned) === "1",
    sort: first(params.sort) ?? "date",
    direction: first(params.dir) ?? "desc",
    page: Number(first(params.page) ?? 1) || 1,
    pageSize: Number(first(params.size) ?? 10) || 10,
  });

  const page = await getTransactionPage(user.id, filters);

  return (
    <div className="space-y-5">
      <TransactionTotals totals={page.totals} count={page.total} />
      <TransactionsTable page={page} />
      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        pageSize={page.pageSize}
        total={page.total}
      />
    </div>
  );
}

function TransactionsLoading() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="glass space-y-2 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
        ))}
      </div>
      <SkeletonList rows={8} />
    </div>
  );
}
