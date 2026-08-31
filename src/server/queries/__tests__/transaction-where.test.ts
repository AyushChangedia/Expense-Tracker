import { test } from "node:test";
import assert from "node:assert/strict";

import { buildTransactionWhere } from "@/server/queries/transactions";
import type { TransactionFilters } from "@/lib/validations";

const USER = "user_1";
const build = (filters: Partial<TransactionFilters> = {}) =>
  buildTransactionWhere(USER, filters);

/**
 * The where clause is the boundary between a URL anyone can edit and the
 * database. Two things have to hold for every possible filter object: the
 * userId scope is never dropped, and a date range means the days the user
 * asked for.
 */

/* -------------------------------------------------------------- scoping -- */

test("the user scope survives every filter combination", () => {
  // Losing it exposes one account's transactions to another. Nothing else in
  // this file matters if this does not hold.
  const combinations: Partial<TransactionFilters>[] = [
    {},
    { query: "coffee" },
    { type: "INCOME" },
    { categoryIds: ["c1"] },
    { tags: ["food"] },
    { from: "2026-03-01", to: "2026-03-31" },
    { minAmount: 10, maxAmount: 100 },
    { pinnedOnly: true },
    {
      query: "x",
      type: "EXPENSE",
      categoryIds: ["c1"],
      tags: ["t"],
      from: "2026-01-01",
      to: "2026-12-31",
      minAmount: 1,
      maxAmount: 2,
      pinnedOnly: true,
    },
  ];
  for (const filters of combinations) {
    assert.equal(build(filters).userId, USER, JSON.stringify(filters));
  }
});

test("an empty filter object scopes to the user and nothing else", () => {
  assert.deepEqual(build(), { userId: USER });
});

/* --------------------------------------------------------------- ranges -- */

test("a date range is inclusive of both days the user picked", () => {
  // `to` is inclusive in the UI, so the query has to run to the start of the
  // following day — a plain `lte` on the 31st drops everything on the 31st.
  const where = build({ from: "2026-03-01", to: "2026-03-31" });
  const date = where.date as { gte: Date; lt: Date };
  assert.equal(date.gte.toISOString(), "2026-03-01T00:00:00.000Z");
  assert.equal(date.lt.toISOString(), "2026-04-01T00:00:00.000Z");
});

test("a single-day range still matches that day", () => {
  const date = build({ from: "2026-03-04", to: "2026-03-04" }).date as { gte: Date; lt: Date };
  assert.equal(date.gte.toISOString(), "2026-03-04T00:00:00.000Z");
  assert.equal(date.lt.toISOString(), "2026-03-05T00:00:00.000Z");
  assert.ok(date.gte < date.lt, "an empty range would match nothing");
});

test("a range ending on a month or year boundary rolls over correctly", () => {
  const dec = build({ from: "2026-12-31", to: "2026-12-31" }).date as { lt: Date };
  assert.equal(dec.lt.toISOString(), "2027-01-01T00:00:00.000Z");
  const feb = build({ from: "2024-02-29", to: "2024-02-29" }).date as { lt: Date };
  assert.equal(feb.lt.toISOString(), "2024-03-01T00:00:00.000Z");
});

test("one open end is allowed", () => {
  assert.ok((build({ from: "2026-03-01" }).date as { gte?: Date }).gte);
  assert.equal((build({ from: "2026-03-01" }).date as { lt?: Date }).lt, undefined);
  assert.ok((build({ to: "2026-03-31" }).date as { lt?: Date }).lt);
});

test("no date filter leaves the date column alone", () => {
  assert.equal(build({ type: "INCOME" }).date, undefined);
});

test("amount bounds are inclusive at both ends", () => {
  const amount = build({ minAmount: 10, maxAmount: 100 }).amount as { gte: number; lte: number };
  assert.equal(amount.gte, 10);
  assert.equal(amount.lte, 100);
});

test("a zero bound is applied rather than treated as absent", () => {
  // `if (min)` would drop this; the code checks against undefined.
  const amount = build({ minAmount: 0 }).amount as { gte: number };
  assert.equal(amount.gte, 0);
});

/* -------------------------------------------------------------- matching -- */

test("ALL is not a type filter", () => {
  assert.equal(build({ type: "ALL" }).type, undefined);
  assert.equal(build({ type: "EXPENSE" }).type, "EXPENSE");
});

test("empty category and tag lists do not narrow anything", () => {
  // An empty `in: []` matches no rows at all, which would show a blank table
  // for a filter the user did not set.
  assert.equal(build({ categoryIds: [] }).categoryId, undefined);
  assert.deepEqual(build({ tags: [] }), { userId: USER });
});

test("a category filter is an in-list", () => {
  assert.deepEqual(build({ categoryIds: ["c1", "c2"] }).categoryId, { in: ["c1", "c2"] });
});

test("a text query searches description, notes, category and tags", () => {
  const and = build({ query: "coffee" }).AND as { OR: unknown[] }[];
  assert.equal(and.length, 1);
  assert.equal(and[0].OR.length, 4, "one clause per searchable field");
  assert.ok(JSON.stringify(and[0].OR).includes("insensitive"), "search must be case-insensitive");
});

test("a whitespace-only query is not a filter", () => {
  // Otherwise typing a space in the search box empties the table.
  assert.equal(build({ query: "   " }).AND, undefined);
});

test("pinnedOnly is applied only when true", () => {
  assert.equal(build({ pinnedOnly: true }).isPinned, true);
  assert.equal(build({ pinnedOnly: false }).isPinned, undefined);
});

test("tag and query clauses accumulate rather than overwrite", () => {
  // Both go into AND; a second assignment would silently drop the first.
  const and = build({ query: "coffee", tags: ["food"] }).AND as unknown[];
  assert.equal(and.length, 2);
});
