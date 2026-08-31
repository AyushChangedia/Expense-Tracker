import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EXPORT_COLUMNS,
  maskCsvCell,
  parseCsv,
  toCsv,
  unmaskCsvCell,
  type ExportRow,
} from "@/lib/import-export";

const row = (over: Partial<ExportRow> = {}): ExportRow => ({
  date: "2026-03-04",
  type: "EXPENSE",
  amount: "240.00",
  description: "Coffee",
  category: "food",
  tags: "",
  notes: "",
  ...over,
});

/** The data line of a one-row export. */
const dataLine = (r: ExportRow) => toCsv([r]).split(/\r?\n/)[1];

const PAYLOADS = [
  "=1+1",
  '=HYPERLINK("http://evil.example","Click")',
  "+1+1",
  "-1+1",
  "@SUM(A1)",
  "\tcmd",
  "\rcmd",
  "=cmd|'/c calc'!A0",
];

test("no exported cell begins with a formula trigger", () => {
  // CWE-1236. A spreadsheet evaluates such a cell on open, and in a finance
  // app the text often came from outside — a payer's reference field on an
  // imported statement.
  for (const payload of PAYLOADS) {
    for (const column of ["description", "notes", "category", "tags"] as const) {
      const line = dataLine(row({ [column]: payload }));
      assert.ok(
        !new RegExp(`(^|,)"?[=+@\\t\\r]`).test(line),
        `${column} = ${JSON.stringify(payload)} exported as ${JSON.stringify(line)}`,
      );
    }
  }
});

test("a dangerous cell is guarded with a leading apostrophe", () => {
  assert.equal(maskCsvCell("=1+1"), "'=1+1");
  assert.equal(maskCsvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(maskCsvCell("\tcmd"), "'\tcmd");
});

test("ordinary text is left completely alone", () => {
  for (const value of ["Coffee", "Rent - March", "3 x lunch", "", "a=b"]) {
    assert.equal(maskCsvCell(value), value, JSON.stringify(value));
  }
});

test("the guard is reversed on import, so the round trip is exact", () => {
  // The module's stated contract: an exported file re-imports without edits.
  // A mitigation that changed the data would break it.
  for (const payload of PAYLOADS) {
    const csv = toCsv([row({ description: payload, notes: payload })]);
    const back = parseCsv(csv);
    assert.equal(back.issues.length, 0, JSON.stringify(back.issues));
    assert.equal(back.rows[0].description, payload, `description ${JSON.stringify(payload)}`);
    assert.equal(back.rows[0].notes, payload, `notes ${JSON.stringify(payload)}`);
  }
});

test("unmask only strips an apostrophe that is actually a guard", () => {
  // A description that legitimately starts with an apostrophe must survive.
  assert.equal(unmaskCsvCell("'tis the season"), "'tis the season");
  assert.equal(unmaskCsvCell("'"), "'");
  assert.equal(unmaskCsvCell("'=1+1"), "=1+1");
  assert.equal(unmaskCsvCell("Coffee"), "Coffee");
});

test("masking is idempotent in the sense that mask then unmask is identity", () => {
  for (const value of [...PAYLOADS, "Coffee", "'tis", "", "-5"]) {
    assert.equal(unmaskCsvCell(maskCsvCell(value)), value, JSON.stringify(value));
  }
});

test("a negative-looking description is guarded but reads back unchanged", () => {
  // "-1+1" is both a plausible note and a formula, which is why the guard
  // cannot simply drop the character.
  const back = parseCsv(toCsv([row({ description: "-1+1" })]));
  assert.equal(back.rows[0].description, "-1+1");
});

test("the header row is untouched", () => {
  assert.equal(toCsv([row()]).split(/\r?\n/)[0], EXPORT_COLUMNS.join(","));
});

test("a missing field exports as empty rather than the string undefined", () => {
  const partial = { date: "2026-03-04", type: "EXPENSE", amount: "1.00", description: "x" };
  const line = dataLine(partial as ExportRow);
  assert.ok(!line.includes("undefined"), line);
});
