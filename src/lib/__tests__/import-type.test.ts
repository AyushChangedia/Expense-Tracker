import { test } from "node:test";
import assert from "node:assert/strict";

import { parseCsv, parseJson } from "@/lib/import-export";

const types = (csv: string) => parseCsv(csv).rows.map((r) => `${r.description}:${r.type}`);

/**
 * coerceType ended in
 *
 *   return amount < 0 ? "EXPENSE" : amount > 0 && raw === "" ? "EXPENSE" : "EXPENSE";
 *
 * — three branches, one answer. Every row of every file without a recognised
 * type column imported as an expense, so a bank statement booked salary
 * credits as spending and the balance came out wrong by twice the income.
 */

test("a signed statement reads negatives as expenses and positives as income", () => {
  assert.deepEqual(
    types(
      [
        "date,description,amount",
        "2026-03-01,Salary,4500.00",
        "2026-03-02,Card payment,-45.20",
        "2026-03-03,Refund,120.00",
        "2026-03-04,Groceries,-88.10",
      ].join("\n"),
    ),
    ["Salary:INCOME", "Card payment:EXPENSE", "Refund:INCOME", "Groceries:EXPENSE"],
  );
});

test("an unsigned list is all expenses, which is what such a list is", () => {
  // No negatives anywhere and no type column: a plain spending list.
  assert.deepEqual(
    types(
      [
        "date,description,amount",
        "2026-03-01,Coffee,240",
        "2026-03-02,Lunch,480",
      ].join("\n"),
    ),
    ["Coffee:EXPENSE", "Lunch:EXPENSE"],
  );
});

test("an explicit type column beats the sign", () => {
  assert.deepEqual(
    types(
      [
        "date,description,amount,type",
        "2026-03-01,Salary,4500,income",
        "2026-03-02,Rent,1200,expense",
        "2026-03-03,Bonus,900,credit",
        "2026-03-04,Card,45,debit",
      ].join("\n"),
    ),
    ["Salary:INCOME", "Rent:EXPENSE", "Bonus:INCOME", "Card:EXPENSE"],
  );
});

test("type words are matched case- and space-insensitively", () => {
  assert.deepEqual(
    types(
      [
        "date,description,amount,type",
        "2026-03-01,A,100,  INCOME  ",
        "2026-03-02,B,100,Debit",
        "2026-03-03,C,100,CR",
      ].join("\n"),
    ),
    ["A:INCOME", "B:EXPENSE", "C:INCOME"],
  );
});

test("separate debit and credit columns are honoured", () => {
  // The shape most bank exports actually use.
  assert.deepEqual(
    types(
      [
        "date,description,debit,credit",
        "2026-03-01,Salary,,4500.00",
        "2026-03-02,Groceries,88.10,",
      ].join("\n"),
    ),
    ["Salary:INCOME", "Groceries:EXPENSE"],
  );
});

test("an unrecognised type word falls through to the sign", () => {
  assert.deepEqual(
    types(
      [
        "date,description,amount,type",
        "2026-03-01,Salary,4500,mystery",
        "2026-03-02,Rent,-1200,mystery",
      ].join("\n"),
    ),
    ["Salary:INCOME", "Rent:EXPENSE"],
  );
});

test("the sign decides direction but never the stored magnitude", () => {
  // The amount column is Decimal(14,2) unsigned; direction lives in `type`.
  const rows = parseCsv(
    ["date,description,amount", "2026-03-01,Salary,4500", "2026-03-02,Rent,-1200"].join("\n"),
  ).rows;
  assert.equal(rows[0].amount, 4500);
  assert.equal(rows[1].amount, 1200);
  assert.ok(rows.every((r) => r.amount > 0));
});

test("the signed-file check reads the amount column under any alias", () => {
  // "value", "total" and "sum" all map to amount, so a negative in any of
  // them is still the file announcing that it uses signs.
  assert.deepEqual(
    types(
      ["date,description,value", "2026-03-01,Salary,4500", "2026-03-02,Rent,-1200"].join("\n"),
    ),
    ["Salary:INCOME", "Rent:EXPENSE"],
  );
});

test("JSON imports get the same treatment", () => {
  const result = parseJson(
    JSON.stringify([
      { date: "2026-03-01", description: "Salary", amount: 4500 },
      { date: "2026-03-02", description: "Rent", amount: -1200 },
    ]),
  );
  assert.deepEqual(
    result.rows.map((r) => `${r.description}:${r.type}`),
    ["Salary:INCOME", "Rent:EXPENSE"],
  );
});

test("a FluxFin export round-trips with its types intact", () => {
  // The export writes an explicit type column, so this must not depend on
  // signs at all.
  const round = parseCsv(
    [
      "date,type,amount,description,category,tags,notes",
      "2026-03-01,INCOME,4500.00,Salary,salary,,",
      "2026-03-02,EXPENSE,1200.00,Rent,housing,,",
    ].join("\n"),
  );
  assert.equal(round.issues.length, 0, JSON.stringify(round.issues));
  assert.deepEqual(
    round.rows.map((r) => `${r.description}:${r.type}:${r.amount}`),
    ["Salary:INCOME:4500", "Rent:EXPENSE:1200"],
  );
});
