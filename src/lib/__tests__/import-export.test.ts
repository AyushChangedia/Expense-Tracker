import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EXPORT_COLUMNS,
  exportFilename,
  matchCategorySlug,
  normaliseRow,
  parseCsv,
  parseJson,
  toCsv,
  type ExportRow,
} from "@/lib/import-export";

/* --------------------------------------------------------------- headers -- */

test("column names are matched loosely enough to take other tools' exports", () => {
  // Case, spaces and punctuation are all stripped before the alias lookup.
  const result = parseCsv(
    ["Transaction Date,Merchant,Amount", "2026-03-04,Blue Tokai,240"].join("\n"),
  );
  assert.equal(result.issues.length, 0, JSON.stringify(result.issues));
  assert.equal(result.rows[0].description, "Blue Tokai");
  assert.equal(result.rows[0].amount, 240);
  assert.equal(result.rows[0].date, "2026-03-04");
});

test("every description alias maps to the description", () => {
  for (const header of ["memo", "details", "name", "title", "merchant", "payee"]) {
    const result = parseCsv([`date,${header},amount`, "2026-03-04,Coffee,240"].join("\n"));
    assert.equal(result.rows[0]?.description, "Coffee", `${header} did not map`);
  }
});

test("every amount alias maps to the amount", () => {
  for (const header of ["amount", "value", "total", "sum"]) {
    const result = parseCsv([`date,description,${header}`, "2026-03-04,Coffee,240"].join("\n"));
    assert.equal(result.rows[0]?.amount, 240, `${header} did not map`);
  }
});

test("detected columns report what the file actually had", () => {
  const result = parseCsv(["date,memo,amount", "2026-03-04,Coffee,240"].join("\n"));
  assert.deepEqual(result.detectedColumns, ["date", "memo", "amount"]);
});

/* ------------------------------------------------------------------ rows -- */

test("a row with no date is rejected and says so", () => {
  const { row, issue } = normaliseRow({ description: "Coffee", amount: "240" }, 2);
  assert.equal(row, undefined);
  assert.equal(issue?.rowNumber, 2);
  assert.match(issue!.message, /date/i);
});

test("a row with an unreadable amount is rejected and quotes it back", () => {
  const { row, issue } = normaliseRow({ date: "2026-03-04", amount: "n/a" }, 7);
  assert.equal(row, undefined);
  assert.match(issue!.message, /n\/a/);
});

test("a zero amount is rejected rather than imported as free", () => {
  const { row, issue } = normaliseRow({ date: "2026-03-04", amount: "0" }, 3);
  assert.equal(row, undefined);
  assert.ok(issue);
});

test("an entirely empty row is called empty, not missing a date", () => {
  const { issue } = normaliseRow({ description: "", amount: "", date: "" }, 4);
  assert.match(issue!.message, /empty/i);
});

test("an amount beyond the column's range is rejected", () => {
  // The column is Decimal(14,2); a value past it would be a write error.
  const { row, issue } = normaliseRow(
    { date: "2026-03-04", description: "x", amount: "9999999999.99" },
    5,
  );
  assert.equal(row, undefined);
  assert.match(issue!.message, /range/i);
});

test("a missing description gets a placeholder rather than an empty cell", () => {
  const { row } = normaliseRow({ date: "2026-03-04", amount: "240" }, 2);
  assert.equal(row?.description, "Imported transaction");
});

test("long descriptions and notes are truncated to their column widths", () => {
  const { row } = normaliseRow(
    { date: "2026-03-04", amount: "1", description: "x".repeat(500), notes: "y".repeat(900) },
    2,
  );
  assert.equal(row?.description.length, 140);
  assert.equal(row?.notes.length, 500);
});

test("amounts are rounded to two decimals", () => {
  const { row } = normaliseRow({ date: "2026-03-04", amount: "12.345", description: "x" }, 2);
  assert.equal(row?.amount, 12.35);
});

test("tags split on any of the three separators and are capped", () => {
  const { row } = normaliseRow(
    { date: "2026-03-04", amount: "1", description: "x", tags: "food; travel|work,misc" },
    2,
  );
  assert.deepEqual(row?.tags, ["food", "travel", "work", "misc"]);

  const many = normaliseRow(
    {
      date: "2026-03-04",
      amount: "1",
      description: "x",
      tags: Array.from({ length: 30 }, (_, i) => `t${i}`).join(","),
    },
    2,
  );
  assert.equal(many.row?.tags.length, 10);
});

test("row numbers match what a spreadsheet shows", () => {
  // Header is row 1, so the first data row is 2.
  const result = parseCsv(
    ["date,description,amount", "2026-03-04,Ok,240", ",Bad,240"].join("\n"),
  );
  assert.equal(result.rows[0].rowNumber, 2);
  assert.equal(result.issues[0].rowNumber, 3);
});

test("a bad row does not stop the rows around it importing", () => {
  const result = parseCsv(
    [
      "date,description,amount",
      "2026-03-01,First,100",
      ",Broken,200",
      "2026-03-03,Third,300",
    ].join("\n"),
  );
  assert.equal(result.rows.length, 2);
  assert.equal(result.issues.length, 1);
  assert.deepEqual(result.rows.map((r) => r.description), ["First", "Third"]);
});

/* ------------------------------------------------------------------ json -- */

test("JSON accepts a bare array and an export envelope alike", () => {
  const entries = [{ date: "2026-03-04", description: "Coffee", amount: 240 }];
  const bare = parseJson(JSON.stringify(entries));
  const enveloped = parseJson(JSON.stringify({ repo: "x", transactions: entries }));
  assert.equal(bare.rows.length, 1);
  assert.equal(enveloped.rows.length, 1);
  assert.deepEqual(bare.rows[0], enveloped.rows[0]);
});

test("invalid JSON is reported as such rather than throwing", () => {
  const result = parseJson("{not json");
  assert.equal(result.rows.length, 0);
  assert.match(result.issues[0].message, /not valid JSON/i);
});

test("JSON of the wrong shape explains the shape it wanted", () => {
  const result = parseJson(JSON.stringify({ hello: "world" }));
  assert.equal(result.rows.length, 0);
  assert.match(result.issues[0].message, /transactions/);
});

test("a non-object entry is reported without losing the rest", () => {
  const result = parseJson(
    JSON.stringify([42, { date: "2026-03-04", description: "Coffee", amount: 240 }]),
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0].message, /not an object/i);
});

/* ---------------------------------------------------------------- export -- */

const exportRow = (over: Partial<ExportRow> = {}): ExportRow => ({
  date: "2026-03-04",
  type: "EXPENSE",
  amount: "240.00",
  description: "Coffee",
  category: "food",
  tags: "",
  notes: "",
  ...over,
});

test("the CSV export writes the declared columns in order", () => {
  // Papa emits CRLF line endings, per RFC 4180.
  const header = toCsv([exportRow()]).split(/\r?\n/)[0];
  assert.equal(header, EXPORT_COLUMNS.join(","));
});

test("a field containing a comma is quoted rather than splitting the row", () => {
  const csv = toCsv([exportRow({ description: "Coffee, milk and sugar" })]);
  assert.ok(csv.includes('"Coffee, milk and sugar"'));
  const back = parseCsv(csv);
  assert.equal(back.rows[0].description, "Coffee, milk and sugar");
});

test("quotes and newlines in a field survive a round trip", () => {
  const csv = toCsv([exportRow({ notes: 'He said "hello"', description: "Two\nlines" })]);
  const back = parseCsv(csv);
  assert.equal(back.rows[0].description, "Two\nlines");
  assert.equal(back.rows[0].notes, 'He said "hello"');
});

test("an exported file re-imports without edits", () => {
  // The stated contract of the module: same columns in both directions.
  const csv = toCsv([
    exportRow({ description: "Salary", type: "INCOME", amount: "4500.00", tags: "work" }),
    exportRow({ description: "Rent", amount: "1200.00", category: "housing" }),
  ]);
  const back = parseCsv(csv);
  assert.equal(back.issues.length, 0, JSON.stringify(back.issues));
  assert.deepEqual(
    back.rows.map((r) => [r.description, r.type, r.amount, r.category]),
    [
      ["Salary", "INCOME", 4500, "food"],
      ["Rent", "EXPENSE", 1200, "housing"],
    ],
  );
});

test("the export filename carries today's date and the right extension", () => {
  const name = exportFilename("csv");
  assert.match(name, /^fluxfin-transactions-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.match(exportFilename("xlsx", "budget"), /^budget-\d{4}-\d{2}-\d{2}\.xlsx$/);
});

/* -------------------------------------------------------------- category -- */

const available = [
  { slug: "food-drink", name: "Food & Drink" },
  { slug: "housing", name: "Housing" },
];

test("a category matches on its slug", () => {
  assert.equal(matchCategorySlug("food-drink", available), "food-drink");
});

test("a category matches on its display name, punctuation and all", () => {
  assert.equal(matchCategorySlug("Food & Drink", available), "food-drink");
  assert.equal(matchCategorySlug("  housing  ", available), "housing");
  assert.equal(matchCategorySlug("HOUSING", available), "housing");
});

test("an unknown category returns null rather than guessing", () => {
  // A wrong category is worse than none: none is visible in the preview.
  assert.equal(matchCategorySlug("Sorcery", available), null);
  assert.equal(matchCategorySlug("", available), null);
});

test("an imported date keeps its calendar day in any timezone", () => {
  // parseDateInput returns local midnight; calling toISOString on that shifts
  // the day backwards anywhere ahead of UTC, so a row dated the 4th imported
  // as the 3rd in Kolkata. Checked here for every input shape.
  for (const input of ["2026-03-04", "2026-03-04T00:00:00", "March 4, 2026", "03/04/2026"]) {
    const { row } = normaliseRow({ date: input, description: "x", amount: "1" }, 2);
    assert.equal(row?.date, "2026-03-04", `${input} produced ${row?.date}`);
  }
});
